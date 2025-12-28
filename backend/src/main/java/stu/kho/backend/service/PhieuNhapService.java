package stu.kho.backend.service;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import stu.kho.backend.dto.ChiTietPhieuNhapRequest;
import stu.kho.backend.dto.PhieuNhapFilterRequest;
import stu.kho.backend.dto.PhieuNhapRequest;
import stu.kho.backend.dto.SanPhamFilterRequest;
import stu.kho.backend.entity.*;
import stu.kho.backend.repository.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

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
            chiTiet.setSoLo(ctRequest.getSoLo());
            chiTiet.setNgayHetHan(ctRequest.getNgayHetHan());
            chiTietPhieuNhapRepository.save(chiTiet);
        }

        logActivity(nguoiLap.getMaNguoiDung(), "Tạo Phiếu Nhập Hàng #" + maPhieuNhapMoi + " (Chờ duyệt)");

        // Trả về đầy đủ thông tin (gồm chi tiết)
        return getPhieuNhapById(maPhieuNhapMoi);
    }

    // =================================================================
    // 2. APPROVE (Duyệt phiếu - Phương thức MỚI)
    // =================================================================
    @Transactional
    public PhieuNhapHang approvePhieuNhap(Integer maPhieuNhap, String tenNguoiDuyet) {
        NguoiDung nguoiDuyet = nguoiDungRepository.findByTenDangNhap(tenNguoiDuyet)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng (người duyệt)."));

        PhieuNhapHang phieuNhap = getPhieuNhapById(maPhieuNhap);

        if (phieuNhap.getTrangThai() != STATUS_CHO_DUYET) {
            throw new RuntimeException("Chỉ có thể duyệt phiếu đang ở trạng thái 'Chờ duyệt'.");
        }

        // Cập nhật tồn kho
        for (ChiTietPhieuNhap ct : phieuNhap.getChiTiet()) {
            capNhatTonKho(phieuNhap.getMaKho(), ct.getMaSP(), ct.getSoLuong());
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
    // 4. UPDATE (Sửa phiếu)
    // =================================================================
    @Transactional
    public PhieuNhapHang updatePhieuNhap(Integer maPhieuNhap, PhieuNhapRequest request, String tenNguoiSua) {
        NguoiDung nguoiSua = nguoiDungRepository.findByTenDangNhap(tenNguoiSua)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng."));

        PhieuNhapHang phieuNhapCu = getPhieuNhapById(maPhieuNhap);

        // --- LOGIC MỚI: KIỂM TRA TRẠNG THÁI ---

        // 1. Nếu phiếu ĐÃ HỦY -> Không cho sửa
        if (phieuNhapCu.getTrangThai() == STATUS_DA_HUY) {
            throw new RuntimeException("Không thể sửa phiếu đã hủy.");
        }
// 2. KIỂM TRA THỜI HẠN (MỚI): Không cho sửa phiếu quá 30 ngày
        LocalDateTime limitDate = LocalDateTime.now().minusDays(30);
        if (phieuNhapCu.getNgayLapPhieu().isBefore(limitDate)) {
            throw new RuntimeException("Không thể sửa phiếu đã được tạo quá 30 ngày.");
        }
        // 2. Nếu phiếu ĐÃ DUYỆT -> Kiểm tra quyền đặc biệt & Rollback kho
        if (phieuNhapCu.getTrangThai() == STATUS_DA_DUYET) {
            // Check quyền
            boolean hasPerm = SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals("PERM_PHIEUNHAP_EDIT_APPROVED"));

            if (!hasPerm) {
                throw new RuntimeException("Bạn không có quyền sửa phiếu nhập đã duyệt.");
            }

            // ROLLBACK KHO (Trừ số lượng cũ ra khỏi kho)
            for (ChiTietPhieuNhap ctCu : phieuNhapCu.getChiTiet()) {
                // Lưu ý: Nếu hàng đã bán hết, việc trừ này sẽ gây lỗi âm kho (Exception sẽ được ném ra từ hàm capNhatTonKho)
                capNhatTonKho(phieuNhapCu.getMaKho(), ctCu.getMaSP(), -ctCu.getSoLuong());
            }
        }
        // ---------------------------------------

        // Xóa chi tiết cũ
        chiTietPhieuNhapRepository.deleteByMaPhieuNhap(maPhieuNhap);

        // Tính toán lại thông tin phiếu
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

            // Lưu chi tiết
            ChiTietPhieuNhap chiTietMoi = new ChiTietPhieuNhap();
            chiTietMoi.setMaPhieuNhap(maPhieuNhap);
            chiTietMoi.setMaSP(ctRequest.getMaSP());
            chiTietMoi.setSoLuong(ctRequest.getSoLuong());
            chiTietMoi.setDonGia(ctRequest.getDonGia());
            chiTietMoi.setThanhTien(ctRequest.getDonGia().multiply(new BigDecimal(ctRequest.getSoLuong())));
            chiTietPhieuNhapRepository.save(chiTietMoi);

            // --- LOGIC MỚI: ÁP DỤNG LẠI KHO (Nếu đang là Đã Duyệt) ---
            if (phieuNhapCu.getTrangThai() == STATUS_DA_DUYET) {
                capNhatTonKho(request.getMaKho(), ctRequest.getMaSP(), ctRequest.getSoLuong());
            }
            // --------------------------------------------------------
        }

        logActivity(nguoiSua.getMaNguoiDung(), "Cập nhật Phiếu Nhập Hàng #" + maPhieuNhap + " (Trạng thái: " + phieuNhapCu.getTrangThai() + ")");
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

        // Nếu đã duyệt -> Hoàn trả tồn kho
        if (phieuNhap.getTrangThai() == STATUS_DA_DUYET) {
            for (ChiTietPhieuNhap ct : phieuNhap.getChiTiet()) {
                capNhatTonKho(phieuNhap.getMaKho(), ct.getMaSP(), -ct.getSoLuong());
            }
        }

        chiTietPhieuNhapRepository.deleteByMaPhieuNhap(maPhieuNhap);
        phieuNhapRepository.deleteById(maPhieuNhap);

        logActivity(nguoiXoa.getMaNguoiDung(), "Xóa Phiếu Nhập Hàng #" + maPhieuNhap);
    }

    // --- CÁC HÀM GET ---
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

    // --- HÀM TIỆN ÍCH ---
    private void capNhatTonKho(Integer maKho, Integer maSP, Integer soLuongThayDoi) {
        if (soLuongThayDoi == 0) return;

        // 1. Cập nhật bảng ChiTietKho
        Optional<ChiTietKho> tonKhoOpt = chiTietKhoRepository.findById(maSP, maKho);

        if (tonKhoOpt.isPresent()) {
            ChiTietKho tonKho = tonKhoOpt.get();
            int soLuongMoi = tonKho.getSoLuongTon() + soLuongThayDoi;
            if (soLuongMoi < 0) {
                throw new RuntimeException("Lỗi: Tồn kho không đủ để trừ.");
            }
            chiTietKhoRepository.updateSoLuongTon(maSP, maKho, soLuongMoi);
        } else {
            if (soLuongThayDoi < 0) {
                throw new RuntimeException("Lỗi: Sản phẩm chưa có trong kho để trừ.");
            }
            ChiTietKho tonKhoMoi = new ChiTietKho();
            tonKhoMoi.setMaSP(maSP);
            tonKhoMoi.setMaKho(maKho);
            tonKhoMoi.setSoLuongTon(soLuongThayDoi);
            chiTietKhoRepository.save(tonKhoMoi);
        }

        // 2. Cập nhật bảng SanPham (Tổng)
        SanPham sanPham = sanPhamRepository.findById(maSP).orElseThrow();
        int tongTonMoi = (sanPham.getSoLuongTon() == null ? 0 : sanPham.getSoLuongTon()) + soLuongThayDoi;
        sanPham.setSoLuongTon(tongTonMoi);
        sanPhamRepository.update(sanPham);
    }

    private void logActivity(Integer maNguoiDung, String hanhDong) {
        HoatDong log = new HoatDong();
        log.setMaNguoiDung(maNguoiDung);
        log.setHanhDong(hanhDong);
        log.setThoiGianThucHien(java.time.LocalDateTime.now()); // Lấy giờ Java (đã set UTC+7)
        hoatDongRepository.save(log);
    }
    public List<PhieuNhapHang> searchPhieuNhap(String chungTu) {
        return phieuNhapRepository.searchByChungTu(chungTu);
    }

    public List<PhieuNhapHang> filterPhieuNhap(PhieuNhapFilterRequest request) {
        return phieuNhapRepository.filter(request);
    }
}