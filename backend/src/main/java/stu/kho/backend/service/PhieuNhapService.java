package stu.kho.backend.service;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import stu.kho.backend.dto.ChiTietPhieuNhapRequest;
import stu.kho.backend.dto.PhieuNhapFilterRequest;
import stu.kho.backend.dto.PhieuNhapRequest;
import stu.kho.backend.entity.*;
import stu.kho.backend.repository.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class PhieuNhapService {

    // Khai báo hằng số cho Trạng Thái
    private static final int STATUS_CHO_DUYET = 1;
    private static final int STATUS_DA_DUYET = 2;
    private static final int STATUS_DA_HUY = 3;

    private final PhieuNhapRepository phieuNhapRepository;
    private final ChiTietPhieuNhapRepository chiTietPhieuNhapRepository;
    private final ChiTietKhoRepository chiTietKhoRepository;
    private final HoatDongRepository hoatDongRepository;
    private final NguoiDungRepository nguoiDungRepository;
    private final SanPhamRepository sanPhamRepository;
    private final NccSanPhamRepository nccSanPhamRepository;

    public PhieuNhapService(PhieuNhapRepository phieuNhapRepository,
                            ChiTietPhieuNhapRepository chiTietPhieuNhapRepository,
                            ChiTietKhoRepository chiTietKhoRepository,
                            HoatDongRepository hoatDongRepository,
                            NguoiDungRepository nguoiDungRepository,
                            SanPhamRepository sanPhamRepository,
                            NccSanPhamRepository nccSanPhamRepository) {
        this.phieuNhapRepository = phieuNhapRepository;
        this.chiTietPhieuNhapRepository = chiTietPhieuNhapRepository;
        this.chiTietKhoRepository = chiTietKhoRepository;
        this.hoatDongRepository = hoatDongRepository;
        this.nguoiDungRepository = nguoiDungRepository;
        this.sanPhamRepository = sanPhamRepository;
        this.nccSanPhamRepository = nccSanPhamRepository;
    }

    // =================================================================
    // 1. CREATE (Tạo phiếu - Chờ duyệt)
    // =================================================================
    @Transactional
    public PhieuNhapHang createPhieuNhap(PhieuNhapRequest request, String tenNguoiLap) {

        NguoiDung nguoiLap = nguoiDungRepository.findByTenDangNhap(tenNguoiLap)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng lập phiếu."));

        // 1. Tính toán tổng tiền
        BigDecimal tongTien = request.getChiTiet().stream()
                .map(ct -> ct.getDonGia().multiply(new BigDecimal(ct.getSoLuong())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 2. Tạo Phiếu Nhập chính
        PhieuNhapHang phieuNhap = new PhieuNhapHang();
        phieuNhap.setTrangThai(STATUS_CHO_DUYET);
        phieuNhap.setMaNCC(request.getMaNCC());
        phieuNhap.setMaKho(request.getMaKho());
        phieuNhap.setNguoiLap(nguoiLap.getMaNguoiDung());
        phieuNhap.setChungTu(request.getChungTu());
        phieuNhap.setTongTien(tongTien);
        phieuNhap.setNgayLapPhieu(LocalDateTime.now());

        Integer maPhieuNhapMoi = phieuNhapRepository.save(phieuNhap);
        phieuNhap.setMaPhieuNhap(maPhieuNhapMoi);

        // 3. Lưu chi tiết
        for (ChiTietPhieuNhapRequest ctRequest : request.getChiTiet()) {
            if (!sanPhamRepository.findById(ctRequest.getMaSP()).isPresent()) {
                throw new RuntimeException("Sản phẩm với Mã SP: " + ctRequest.getMaSP() + " không tồn tại.");
            }

            // Kiểm tra liên kết NCC
            boolean isLinked = nccSanPhamRepository.existsLink(request.getMaNCC(), ctRequest.getMaSP());
            if (!isLinked) {
                throw new RuntimeException("Lỗi: Nhà cung cấp không được phép cung cấp sản phẩm SP#" + ctRequest.getMaSP());
            }

            ChiTietPhieuNhap chiTiet = new ChiTietPhieuNhap();
            chiTiet.setMaPhieuNhap(maPhieuNhapMoi);
            chiTiet.setMaSP(ctRequest.getMaSP());
            chiTiet.setSoLuong(ctRequest.getSoLuong());
            chiTiet.setDonGia(ctRequest.getDonGia());
            chiTiet.setThanhTien(ctRequest.getDonGia().multiply(new BigDecimal(ctRequest.getSoLuong())));

            // [QUAN TRỌNG] Lưu thông tin Lô và Hạn sử dụng từ Request vào Database
            chiTiet.setSoLo(ctRequest.getSoLo());
            chiTiet.setNgayHetHan(ctRequest.getNgayHetHan());

            chiTietPhieuNhapRepository.save(chiTiet);
        }

        logActivity(nguoiLap.getMaNguoiDung(), "Tạo Phiếu Nhập Hàng #" + maPhieuNhapMoi + " (Chờ duyệt)");

        return getPhieuNhapById(maPhieuNhapMoi);
    }

    // =================================================================
    // 2. APPROVE (Duyệt phiếu - Đã Fix lỗi NULL SoLo)
    // =================================================================
    @Transactional
    public PhieuNhapHang approvePhieuNhap(Integer maPhieuNhap, String tenNguoiDuyet) {
        NguoiDung nguoiDuyet = nguoiDungRepository.findByTenDangNhap(tenNguoiDuyet)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng (người duyệt)."));

        PhieuNhapHang phieuNhap = getPhieuNhapById(maPhieuNhap);

        if (phieuNhap.getTrangThai() != STATUS_CHO_DUYET) {
            throw new RuntimeException("Chỉ có thể duyệt phiếu đang ở trạng thái 'Chờ duyệt'.");
        }

        // Cập nhật tồn kho (LOOP qua từng chi tiết)
        for (ChiTietPhieuNhap ct : phieuNhap.getChiTiet()) {
            // [FIX ERROR] Truyền đầy đủ SoLo và NgayHetHan vào hàm cập nhật
            capNhatTonKho(
                    phieuNhap.getMaKho(),
                    ct.getMaSP(),
                    ct.getSoLo(),         // <--- QUAN TRỌNG
                    ct.getNgayHetHan(),   // <--- QUAN TRỌNG
                    ct.getSoLuong()
            );
        }

        phieuNhap.setTrangThai(STATUS_DA_DUYET);
        phieuNhap.setNguoiDuyet(nguoiDuyet.getMaNguoiDung());
        phieuNhapRepository.update(phieuNhap);

        logActivity(nguoiDuyet.getMaNguoiDung(), "Đã duyệt Phiếu Nhập Hàng #" + maPhieuNhap);
        return phieuNhap;
    }

    // =================================================================
    // 3. CANCEL (Hủy phiếu)
    // =================================================================
    @Transactional
    public PhieuNhapHang cancelPhieuNhap(Integer id, String tenNguoiHuy) {
        NguoiDung nguoiHuy = nguoiDungRepository.findByTenDangNhap(tenNguoiHuy)
                .orElseThrow(() -> new RuntimeException("User not found"));

        PhieuNhapHang phieuNhap = getPhieuNhapById(id);

        if (phieuNhap.getTrangThai() == STATUS_DA_HUY) {
            throw new RuntimeException("Phiếu này đã bị hủy trước đó.");
        }

        if (phieuNhap.getTrangThai() == STATUS_DA_DUYET) {
            throw new RuntimeException("Không thể hủy phiếu đã được duyệt (Hàng đã nhập kho).");
        }

        phieuNhap.setTrangThai(STATUS_DA_HUY);
        phieuNhap.setNguoiDuyet(nguoiHuy.getMaNguoiDung());
        phieuNhapRepository.update(phieuNhap);

        logActivity(nguoiHuy.getMaNguoiDung(), "Hủy Phiếu Nhập #" + id);
        return phieuNhap;
    }

    // =================================================================
    // 4. UPDATE (Sửa phiếu - Đã cập nhật logic Lô)
    // =================================================================
    @Transactional
    public PhieuNhapHang updatePhieuNhap(Integer maPhieuNhap, PhieuNhapRequest request, String tenNguoiSua) {
        NguoiDung nguoiSua = nguoiDungRepository.findByTenDangNhap(tenNguoiSua)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng."));

        PhieuNhapHang phieuNhapCu = getPhieuNhapById(maPhieuNhap);

        // 1. Nếu phiếu ĐÃ HỦY -> Không cho sửa
        if (phieuNhapCu.getTrangThai() == STATUS_DA_HUY) {
            throw new RuntimeException("Không thể sửa phiếu đã hủy.");
        }

        // 2. KIỂM TRA THỜI HẠN
        LocalDateTime limitDate = LocalDateTime.now().minusDays(30);
        if (phieuNhapCu.getNgayLapPhieu().isBefore(limitDate)) {
            throw new RuntimeException("Không thể sửa phiếu đã được tạo quá 30 ngày.");
        }

        // 3. Nếu phiếu ĐÃ DUYỆT -> Kiểm tra quyền & Rollback kho
        if (phieuNhapCu.getTrangThai() == STATUS_DA_DUYET) {
            boolean hasPerm = SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals("PERM_PHIEUNHAP_EDIT_APPROVED"));

            if (!hasPerm) {
                throw new RuntimeException("Bạn không có quyền sửa phiếu nhập đã duyệt.");
            }

            // ROLLBACK KHO (Trừ số lượng cũ ra khỏi đúng LÔ đó)
            for (ChiTietPhieuNhap ctCu : phieuNhapCu.getChiTiet()) {
                capNhatTonKho(
                        phieuNhapCu.getMaKho(),
                        ctCu.getMaSP(),
                        ctCu.getSoLo(),        // Trừ đúng lô cũ
                        ctCu.getNgayHetHan(),
                        -ctCu.getSoLuong()     // Số lượng âm để trừ
                );
            }
        }

        // Xóa chi tiết cũ
        chiTietPhieuNhapRepository.deleteByMaPhieuNhap(maPhieuNhap);

        // Cập nhật thông tin phiếu chính
        BigDecimal tongTienMoi = request.getChiTiet().stream()
                .map(ct -> ct.getDonGia().multiply(new BigDecimal(ct.getSoLuong())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        phieuNhapCu.setMaNCC(request.getMaNCC());
        phieuNhapCu.setMaKho(request.getMaKho());
        phieuNhapCu.setChungTu(request.getChungTu());
        phieuNhapCu.setTongTien(tongTienMoi);

        phieuNhapRepository.update(phieuNhapCu);

        // Thêm chi tiết MỚI
        for (ChiTietPhieuNhapRequest ctRequest : request.getChiTiet()) {
            if (!sanPhamRepository.findById(ctRequest.getMaSP()).isPresent()) {
                throw new RuntimeException("Sản phẩm SP#" + ctRequest.getMaSP() + " không tồn tại.");
            }

            ChiTietPhieuNhap chiTietMoi = new ChiTietPhieuNhap();
            chiTietMoi.setMaPhieuNhap(maPhieuNhap);
            chiTietMoi.setMaSP(ctRequest.getMaSP());
            chiTietMoi.setSoLuong(ctRequest.getSoLuong());
            chiTietMoi.setDonGia(ctRequest.getDonGia());
            chiTietMoi.setThanhTien(ctRequest.getDonGia().multiply(new BigDecimal(ctRequest.getSoLuong())));

            // Set thông tin lô
            chiTietMoi.setSoLo(ctRequest.getSoLo());
            chiTietMoi.setNgayHetHan(ctRequest.getNgayHetHan());

            chiTietPhieuNhapRepository.save(chiTietMoi);

            // NẾU ĐANG LÀ ĐÃ DUYỆT -> CỘNG LẠI KHO MỚI
            if (phieuNhapCu.getTrangThai() == STATUS_DA_DUYET) {
                capNhatTonKho(
                        request.getMaKho(),
                        ctRequest.getMaSP(),
                        ctRequest.getSoLo(),
                        ctRequest.getNgayHetHan(),
                        ctRequest.getSoLuong()
                );
            }
        }

        logActivity(nguoiSua.getMaNguoiDung(), "Cập nhật Phiếu Nhập Hàng #" + maPhieuNhap);
        return getPhieuNhapById(maPhieuNhap);
    }

    // =================================================================
    // 5. DELETE (Xóa phiếu)
    // =================================================================
    @Transactional
    public void deletePhieuNhap(Integer maPhieuNhap, String tenNguoiXoa) {
        NguoiDung nguoiXoa = nguoiDungRepository.findByTenDangNhap(tenNguoiXoa)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng."));

        PhieuNhapHang phieuNhap = getPhieuNhapById(maPhieuNhap);

        // Nếu đã duyệt -> Hoàn trả tồn kho (Trừ kho)
        if (phieuNhap.getTrangThai() == STATUS_DA_DUYET) {
            for (ChiTietPhieuNhap ct : phieuNhap.getChiTiet()) {
                capNhatTonKho(
                        phieuNhap.getMaKho(),
                        ct.getMaSP(),
                        ct.getSoLo(),       // Trừ đúng lô
                        ct.getNgayHetHan(),
                        -ct.getSoLuong()    // Số âm để trừ
                );
            }
        }

        chiTietPhieuNhapRepository.deleteByMaPhieuNhap(maPhieuNhap);
        phieuNhapRepository.deleteById(maPhieuNhap);

        logActivity(nguoiXoa.getMaNguoiDung(), "Xóa Phiếu Nhập Hàng #" + maPhieuNhap);
    }

    // --- CÁC HÀM GET & SEARCH ---
    public List<PhieuNhapHang> getAllPhieuNhap() {
        return phieuNhapRepository.findAll();
    }

    public PhieuNhapHang getPhieuNhapById(Integer id) {
        PhieuNhapHang pnh = phieuNhapRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy Phiếu Nhập #" + id));

        List<ChiTietPhieuNhap> chiTiet = chiTietPhieuNhapRepository.findByMaPhieuNhap(id);
        pnh.setChiTiet(chiTiet);
        return pnh;
    }

    public List<PhieuNhapHang> searchPhieuNhap(String chungTu) {
        return phieuNhapRepository.searchByChungTu(chungTu);
    }

    public List<PhieuNhapHang> filterPhieuNhap(PhieuNhapFilterRequest request) {
        return phieuNhapRepository.filter(request);
    }

    // =================================================================
    // HÀM TIỆN ÍCH QUAN TRỌNG: CẬP NHẬT KHO THEO LÔ
    // =================================================================
    private void capNhatTonKho(Integer maKho, Integer maSP, String soLo, LocalDate ngayHetHan, Integer soLuongThayDoi) {
        if (soLuongThayDoi == 0) return;

        // 1. Xử lý trường hợp SoLo bị null (gán mặc định để tránh lỗi SQL)
        String batchName = (soLo == null || soLo.isEmpty()) ? "LO-DEFAULT" : soLo;

        // 2. Gọi Repository để Upsert (Insert hoặc Update) vào bảng chitietkho
        // Lưu ý: Hàm upsertTonKho phải được định nghĩa trong JdbcChiTietKhoRepository
        chiTietKhoRepository.upsertTonKho(maKho, maSP, batchName, ngayHetHan, soLuongThayDoi);

        // 3. Cập nhật bảng SanPham (Tổng tồn kho của tất cả các lô)
        // Phần này giữ nguyên vì bảng Sản Phẩm chỉ quan tâm tổng số lượng
        SanPham sanPham = sanPhamRepository.findById(maSP).orElseThrow();
        int tongTonMoi = (sanPham.getSoLuongTon() == null ? 0 : sanPham.getSoLuongTon()) + soLuongThayDoi;

        // Tránh số lượng âm trên tổng
        if (tongTonMoi < 0) {
            // Có thể throw exception hoặc cho phép âm tuỳ nghiệp vụ, ở đây mình tạm cho phép để đồng bộ
            // throw new RuntimeException("Lỗi logic: Tổng tồn sản phẩm bị âm.");
        }

        sanPham.setSoLuongTon(tongTonMoi);
        sanPhamRepository.update(sanPham);
    }

    private void logActivity(Integer maNguoiDung, String hanhDong) {
        HoatDong log = new HoatDong();
        log.setMaNguoiDung(maNguoiDung);
        log.setHanhDong(hanhDong);
        log.setThoiGianThucHien(LocalDateTime.now());
        hoatDongRepository.save(log);
    }
}