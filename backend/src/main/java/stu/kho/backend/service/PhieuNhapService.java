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
    // 1. CREATE (Tạo phiếu)
    // =================================================================
    @Transactional
    public PhieuNhapHang createPhieuNhap(PhieuNhapRequest request, String tenNguoiLap) {
        NguoiDung nguoiLap = nguoiDungRepository.findByTenDangNhap(tenNguoiLap)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng lập phiếu."));

        BigDecimal tongTien = request.getChiTiet().stream()
                .map(ct -> ct.getDonGia().multiply(new BigDecimal(ct.getSoLuong())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

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

        for (ChiTietPhieuNhapRequest ctRequest : request.getChiTiet()) {
            if (!sanPhamRepository.findById(ctRequest.getMaSP()).isPresent()) {
                throw new RuntimeException("Sản phẩm với Mã SP: " + ctRequest.getMaSP() + " không tồn tại.");
            }

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

        logActivity(nguoiLap.getMaNguoiDung(), "Tạo Phiếu Nhập Hàng #" + maPhieuNhapMoi);
        return getPhieuNhapById(maPhieuNhapMoi);
    }

    // =================================================================
    // 2. APPROVE (Duyệt phiếu - CHẶN TRÙNG LÔ & FIX NULL LIST)
    // =================================================================
    @Transactional
    public PhieuNhapHang approvePhieuNhap(Integer id, String tenNguoiDuyet) {
        NguoiDung nguoiDuyet = nguoiDungRepository.findByTenDangNhap(tenNguoiDuyet)
                .orElseThrow(() -> new RuntimeException("User not found"));

        PhieuNhapHang phieuNhap = phieuNhapRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Phiếu nhập không tồn tại"));

        if (phieuNhap.getTrangThai() != STATUS_CHO_DUYET) {
            throw new RuntimeException("Chỉ được duyệt phiếu đang ở trạng thái Chờ.");
        }

        // [QUAN TRỌNG] Lấy danh sách chi tiết từ DB lên
        // Nếu không có dòng này, phieuNhap.getChiTiet() có thể bị null -> Bỏ qua kiểm tra -> Duyệt sai
        List<ChiTietPhieuNhap> listChiTiet = chiTietPhieuNhapRepository.findByMaPhieuNhap(id);
        phieuNhap.setChiTiet(listChiTiet);

        // --- KIỂM TRA LOGIC CHẶN TRÙNG LÔ ---
        for (ChiTietPhieuNhap ct : listChiTiet) {
            // 1. Kiểm tra xem Lô này đã có trong kho chưa
            boolean daTonTai = chiTietKhoRepository.checkLooTonTai(
                    phieuNhap.getMaKho(),
                    ct.getMaSP(),
                    ct.getSoLo()
            );

            // 2. Nếu có rồi -> BÁO LỖI NGAY LẬP TỨC (Không cho nhập trùng)
            if (daTonTai) {
                throw new RuntimeException("LỖI: Lô hàng " + ct.getSoLo() + " của sản phẩm " + ct.getMaSP() + " đã tồn tại trong kho. Vui lòng kiểm tra lại!");
            }

            // 3. Nếu chưa có -> Thêm mới (INSERT)
            ChiTietKho khoMoi = new ChiTietKho();
            khoMoi.setMaKho(phieuNhap.getMaKho());
            khoMoi.setMaSP(ct.getMaSP());
            khoMoi.setSoLo(ct.getSoLo());
            khoMoi.setNgayHetHan(ct.getNgayHetHan());
            khoMoi.setSoLuongTon(ct.getSoLuong());

            // Lưu vào kho
            chiTietKhoRepository.save(khoMoi);

            // 4. Cập nhật tổng tồn kho
            updateTongTonKhoSanPham(ct.getMaSP(), ct.getSoLuong());
        }

        // Cập nhật trạng thái phiếu
        phieuNhap.setTrangThai(STATUS_DA_DUYET);
        phieuNhap.setNguoiDuyet(nguoiDuyet.getMaNguoiDung());
        phieuNhapRepository.update(phieuNhap);

        logActivity(nguoiDuyet.getMaNguoiDung(), "Duyệt Phiếu Nhập #" + id);
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

        if (phieuNhapCu.getTrangThai() == STATUS_DA_HUY) {
            throw new RuntimeException("Không thể sửa phiếu đã hủy.");
        }

        LocalDateTime limitDate = LocalDateTime.now().minusDays(30);
        if (phieuNhapCu.getNgayLapPhieu().isBefore(limitDate)) {
            throw new RuntimeException("Không thể sửa phiếu đã được tạo quá 30 ngày.");
        }

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
                        ctCu.getSoLo(),
                        ctCu.getNgayHetHan(),
                        -ctCu.getSoLuong()
                );
            }
        }

        chiTietPhieuNhapRepository.deleteByMaPhieuNhap(maPhieuNhap);

        BigDecimal tongTienMoi = request.getChiTiet().stream()
                .map(ct -> ct.getDonGia().multiply(new BigDecimal(ct.getSoLuong())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        phieuNhapCu.setMaNCC(request.getMaNCC());
        phieuNhapCu.setMaKho(request.getMaKho());
        phieuNhapCu.setChungTu(request.getChungTu());
        phieuNhapCu.setTongTien(tongTienMoi);

        phieuNhapRepository.update(phieuNhapCu);

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
            chiTietMoi.setSoLo(ctRequest.getSoLo());
            chiTietMoi.setNgayHetHan(ctRequest.getNgayHetHan());

            chiTietPhieuNhapRepository.save(chiTietMoi);

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

        if (phieuNhap.getTrangThai() == STATUS_DA_DUYET) {
            for (ChiTietPhieuNhap ct : phieuNhap.getChiTiet()) {
                capNhatTonKho(
                        phieuNhap.getMaKho(),
                        ct.getMaSP(),
                        ct.getSoLo(),
                        ct.getNgayHetHan(),
                        -ct.getSoLuong()
                );
            }
        }

        chiTietPhieuNhapRepository.deleteByMaPhieuNhap(maPhieuNhap);
        phieuNhapRepository.deleteById(maPhieuNhap);

        logActivity(nguoiXoa.getMaNguoiDung(), "Xóa Phiếu Nhập Hàng #" + maPhieuNhap);
    }

    // --- HELPER FUNCTIONS ---

    public List<PhieuNhapHang> getAllPhieuNhap() {
        return phieuNhapRepository.findAll();
    }

    public PhieuNhapHang getPhieuNhapById(Integer id) {
        PhieuNhapHang pnh = phieuNhapRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy Phiếu Nhập #" + id));
        pnh.setChiTiet(chiTietPhieuNhapRepository.findByMaPhieuNhap(id));
        return pnh;
    }

    public List<PhieuNhapHang> searchPhieuNhap(String chungTu) {
        return phieuNhapRepository.searchByChungTu(chungTu);
    }

    public List<PhieuNhapHang> filterPhieuNhap(PhieuNhapFilterRequest request) {
        return phieuNhapRepository.filter(request);
    }

    private void updateTongTonKhoSanPham(Integer maSP, int soLuongThem) {
        SanPham sp = sanPhamRepository.findById(maSP).orElse(null);
        if (sp != null) {
            int tonCu = (sp.getSoLuongTon() == null) ? 0 : sp.getSoLuongTon();
            sp.setSoLuongTon(tonCu + soLuongThem);
            sanPhamRepository.update(sp);
        }
    }

    private void capNhatTonKho(Integer maKho, Integer maSP, String soLo, LocalDate ngayHetHan, Integer soLuongThayDoi) {
        if (soLuongThayDoi == 0) return;
        String batchName = (soLo == null || soLo.isEmpty()) ? "LO-DEFAULT" : soLo;
        chiTietKhoRepository.upsertTonKho(maKho, maSP, batchName, ngayHetHan, soLuongThayDoi);

        SanPham sanPham = sanPhamRepository.findById(maSP).orElseThrow();
        int tongTonMoi = (sanPham.getSoLuongTon() == null ? 0 : sanPham.getSoLuongTon()) + soLuongThayDoi;
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