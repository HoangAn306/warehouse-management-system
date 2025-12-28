package stu.kho.backend.service;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import stu.kho.backend.dto.ChiTietPhieuXuatRequest;
import stu.kho.backend.dto.PhieuXuatFilterRequest;
import stu.kho.backend.dto.PhieuXuatRequest;
import stu.kho.backend.entity.*;
import stu.kho.backend.repository.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class PhieuXuatService {

    private static final int STATUS_CHO_DUYET = 1;
    private static final int STATUS_DA_DUYET = 2;
    private static final int STATUS_DA_HUY = 3;

    private final PhieuXuatRepository phieuXuatRepository;
    private final ChiTietPhieuXuatRepository chiTietPhieuXuatRepository;
    private final ChiTietKhoRepository chiTietKhoRepository;
    private final HoatDongRepository hoatDongRepository;
    private final NguoiDungRepository nguoiDungRepository;
    private final SanPhamRepository sanPhamRepository;
    private final KhachHangRepository khachHangRepository;
    private final JdbcTemplate jdbcTemplate; // [MỚI] Dùng để check Lô và Hạn


    public PhieuXuatService(PhieuXuatRepository phieuXuatRepository,
                            ChiTietPhieuXuatRepository chiTietPhieuXuatRepository,
                            ChiTietKhoRepository chiTietKhoRepository,
                            HoatDongRepository hoatDongRepository,
                            NguoiDungRepository nguoiDungRepository,
                            SanPhamRepository sanPhamRepository,
                            KhachHangRepository khachHangRepository,
                            JdbcTemplate jdbcTemplate) {
        this.phieuXuatRepository = phieuXuatRepository;
        this.chiTietPhieuXuatRepository = chiTietPhieuXuatRepository;
        this.chiTietKhoRepository = chiTietKhoRepository;
        this.hoatDongRepository = hoatDongRepository;
        this.nguoiDungRepository = nguoiDungRepository;
        this.sanPhamRepository = sanPhamRepository;
        this.khachHangRepository = khachHangRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    // =================================================================
    // 1. CREATE (Tạo phiếu - CHƯA TRỪ KHO)
    // =================================================================
    @Transactional
    public PhieuXuatHang createPhieuXuat(PhieuXuatRequest request, String tenNguoiLap) {
        NguoiDung nguoiLap = nguoiDungRepository.findByTenDangNhap(tenNguoiLap)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng."));

        // 1. Kiểm tra sơ bộ tồn kho (Check xem lô đó có đủ hàng không)
        for (ChiTietPhieuXuatRequest item : request.getChiTiet()) {
            checkTonKhoLoHang(request.getMaKho(), item.getMaSP(), item.getSoLo(), item.getSoLuong());
        }

        // 2. Tính tổng tiền
        BigDecimal tongTien = request.getChiTiet().stream()
                .map(ct -> ct.getDonGia().multiply(new BigDecimal(ct.getSoLuong())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 3. Lưu Phiếu Chính
        PhieuXuatHang phieuXuat = new PhieuXuatHang();
        phieuXuat.setTrangThai(STATUS_CHO_DUYET);
        phieuXuat.setMaKH(request.getMaKH());
        phieuXuat.setMaKho(request.getMaKho());
        phieuXuat.setNguoiLap(nguoiLap.getMaNguoiDung());
        phieuXuat.setChungTu(request.getChungTu());
        phieuXuat.setTongTien(tongTien);
        phieuXuat.setNgayLapPhieu(LocalDateTime.now());

        Integer maPhieuXuatMoi = phieuXuatRepository.save(phieuXuat);
        phieuXuat.setMaPhieuXuat(maPhieuXuatMoi);

        // 4. Lưu Chi Tiết (KÈM SỐ LÔ)
        for (ChiTietPhieuXuatRequest ctRequest : request.getChiTiet()) {
            ChiTietPhieuXuat chiTiet = new ChiTietPhieuXuat();
            chiTiet.setMaPhieuXuat(maPhieuXuatMoi);
            chiTiet.setMaSP(ctRequest.getMaSP());
            chiTiet.setSoLuong(ctRequest.getSoLuong());
            chiTiet.setDonGia(ctRequest.getDonGia());
            chiTiet.setThanhTien(ctRequest.getDonGia().multiply(new BigDecimal(ctRequest.getSoLuong())));

            // [MỚI] Lưu số lô
            chiTiet.setSoLo(ctRequest.getSoLo());
            // Lưu ý: Ngày hết hạn lấy từ kho khi xuất, hoặc frontend gửi lên nếu cần lưu lịch sử

            chiTietPhieuXuatRepository.save(chiTiet);
        }

        logActivity(nguoiLap.getMaNguoiDung(), "Tạo Phiếu Xuất Hàng #" + maPhieuXuatMoi);
        return phieuXuat;
    }

    // =================================================================
    // 2. APPROVE (Duyệt - TRỪ TỒN KHO & CHECK HẠN SỬ DỤNG)
    // =================================================================
    @Transactional
    public PhieuXuatHang approvePhieuXuat(Integer id, String tenNguoiDuyet) {
        NguoiDung nguoiDuyet = nguoiDungRepository.findByTenDangNhap(tenNguoiDuyet)
                .orElseThrow(() -> new RuntimeException("User not found"));

        PhieuXuatHang phieuXuat = getPhieuXuatById(id);

        if (phieuXuat.getTrangThai() != STATUS_CHO_DUYET) {
            throw new RuntimeException("Chỉ duyệt được phiếu đang chờ.");
        }

        LocalDate homNay = LocalDate.now();

        // [QUAN TRỌNG] Duyệt từng dòng chi tiết
        for (ChiTietPhieuXuat ct : phieuXuat.getChiTiet()) {
            // Kiểm tra kỹ lại tồn kho và hạn sử dụng trước khi trừ
            String sqlCheck = "SELECT SoLuongTon, NgayHetHan FROM chitietkho WHERE MaKho = ? AND MaSP = ? AND SoLo = ?";

            try {
                Map<String, Object> info = jdbcTemplate.queryForMap(sqlCheck,
                        phieuXuat.getMaKho(), ct.getMaSP(), ct.getSoLo());

                int tonHienTai = (Integer) info.get("SoLuongTon");
                java.sql.Date sqlDate = (java.sql.Date) info.get("NgayHetHan");
                LocalDate ngayHetHan = (sqlDate != null) ? sqlDate.toLocalDate() : null;

                // Check 1: Đủ hàng không?
                if (tonHienTai < ct.getSoLuong()) {
                    throw new RuntimeException("Sản phẩm " + ct.getMaSP() + " lô " + ct.getSoLo() + " không đủ hàng để xuất.");
                }

                // Check 2: Hết hạn chưa?
                if (ngayHetHan != null && ngayHetHan.isBefore(homNay)) {
                    throw new RuntimeException("CHẶN XUẤT: Lô hàng " + ct.getSoLo() + " của SP " + ct.getMaSP() +
                            " đã hết hạn ngày " + ngayHetHan + ".");
                }

            } catch (EmptyResultDataAccessException e) {
                throw new RuntimeException("Không tìm thấy lô hàng " + ct.getSoLo() + " trong kho này.");
            }

            // Nếu qua được các bước trên -> Trừ kho
            capNhatTonKhoTheoLo(phieuXuat.getMaKho(), ct.getMaSP(), ct.getSoLo(), -ct.getSoLuong());
        }

        // 2. Cập nhật trạng thái
        phieuXuat.setTrangThai(STATUS_DA_DUYET);
        phieuXuat.setNguoiDuyet(nguoiDuyet.getMaNguoiDung());
        phieuXuatRepository.update(phieuXuat);

        logActivity(nguoiDuyet.getMaNguoiDung(), "Duyệt Phiếu Xuất #" + id);
        return phieuXuat;
    }

    // =================================================================
    // 3. CANCEL (Hủy)
    // =================================================================
    @Transactional
    public PhieuXuatHang cancelPhieuXuat(Integer id, String tenNguoiHuy) {
        NguoiDung nguoiHuy = nguoiDungRepository.findByTenDangNhap(tenNguoiHuy)
                .orElseThrow(() -> new RuntimeException("User not found"));

        PhieuXuatHang phieuXuat = getPhieuXuatById(id);

        if (phieuXuat.getTrangThai() == STATUS_DA_HUY) {
            throw new RuntimeException("Phiếu này đã bị hủy trước đó.");
        }

        if (phieuXuat.getTrangThai() == STATUS_DA_DUYET) {
            throw new RuntimeException("Không thể hủy phiếu đã duyệt (Hàng đã xuất).");
        }

        phieuXuat.setTrangThai(STATUS_DA_HUY);
        phieuXuat.setNguoiDuyet(nguoiHuy.getMaNguoiDung());
        phieuXuatRepository.update(phieuXuat);

        logActivity(nguoiHuy.getMaNguoiDung(), "Hủy Phiếu Xuất #" + id);
        return phieuXuat;
    }

    // =================================================================
    // 4. UPDATE (Sửa phiếu xuất)
    // =================================================================
    @Transactional
    public PhieuXuatHang updatePhieuXuat(Integer maPhieuXuat, PhieuXuatRequest request, String tenNguoiSua) {
        NguoiDung nguoiSua = nguoiDungRepository.findByTenDangNhap(tenNguoiSua)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng."));

        PhieuXuatHang phieuXuatCu = getPhieuXuatById(maPhieuXuat);

        if (phieuXuatCu.getTrangThai() == STATUS_DA_HUY) {
            throw new RuntimeException("Không thể sửa phiếu đã hủy.");
        }

        LocalDateTime limitDate = LocalDateTime.now().minusDays(30);
        if (phieuXuatCu.getNgayLapPhieu().isBefore(limitDate)) {
            throw new RuntimeException("Không thể sửa phiếu đã được tạo quá 30 ngày.");
        }

        // Nếu phiếu ĐÃ DUYỆT -> Cần Rollback kho trước khi sửa
        if (phieuXuatCu.getTrangThai() == STATUS_DA_DUYET) {
            boolean hasPerm = SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals("PERM_PHIEUXUAT_EDIT_APPROVED"));

            if (!hasPerm) {
                throw new RuntimeException("Bạn không có quyền sửa phiếu xuất đã duyệt.");
            }

            // ROLLBACK: Cộng lại hàng vào đúng Lô cũ
            for (ChiTietPhieuXuat ctCu : phieuXuatCu.getChiTiet()) {
                capNhatTonKhoTheoLo(phieuXuatCu.getMaKho(), ctCu.getMaSP(), ctCu.getSoLo(), ctCu.getSoLuong());
            }
        }

        // Xóa chi tiết cũ
        chiTietPhieuXuatRepository.deleteByMaPhieuXuat(maPhieuXuat);

        // Update thông tin phiếu
        BigDecimal tongTienMoi = request.getChiTiet().stream()
                .map(ct -> ct.getDonGia().multiply(new BigDecimal(ct.getSoLuong())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        phieuXuatCu.setMaKH(request.getMaKH());
        phieuXuatCu.setMaKho(request.getMaKho());
        phieuXuatCu.setChungTu(request.getChungTu());
        phieuXuatCu.setTongTien(tongTienMoi);
        phieuXuatRepository.update(phieuXuatCu);

        // Thêm chi tiết MỚI
        for (ChiTietPhieuXuatRequest ctRequest : request.getChiTiet()) {
            checkTonKhoLoHang(request.getMaKho(), ctRequest.getMaSP(), ctRequest.getSoLo(), ctRequest.getSoLuong());

            ChiTietPhieuXuat chiTietMoi = new ChiTietPhieuXuat();
            chiTietMoi.setMaPhieuXuat(maPhieuXuat);
            chiTietMoi.setMaSP(ctRequest.getMaSP());
            chiTietMoi.setSoLuong(ctRequest.getSoLuong());
            chiTietMoi.setDonGia(ctRequest.getDonGia());
            chiTietMoi.setThanhTien(ctRequest.getDonGia().multiply(new BigDecimal(ctRequest.getSoLuong())));
            chiTietMoi.setSoLo(ctRequest.getSoLo()); // [MỚI]

            chiTietPhieuXuatRepository.save(chiTietMoi);

            // Nếu đang là Đã Duyệt -> Trừ kho theo Lô mới
            if (phieuXuatCu.getTrangThai() == STATUS_DA_DUYET) {
                capNhatTonKhoTheoLo(request.getMaKho(), ctRequest.getMaSP(), ctRequest.getSoLo(), -ctRequest.getSoLuong());
            }
        }

        logActivity(nguoiSua.getMaNguoiDung(), "Cập nhật Phiếu Xuất Hàng #" + maPhieuXuat);
        return getPhieuXuatById(maPhieuXuat);
    }

    // =================================================================
    // 5. DELETE (Xóa phiếu xuất)
    // =================================================================
    @Transactional
    public void deletePhieuXuat(Integer maPhieuXuat, String tenNguoiXoa) {
        NguoiDung nguoiXoa = nguoiDungRepository.findByTenDangNhap(tenNguoiXoa)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng."));

        PhieuXuatHang phieuXuat = getPhieuXuatById(maPhieuXuat);

        // Nếu phiếu ĐÃ DUYỆT -> Hoàn trả tồn kho (đúng lô)
        if (phieuXuat.getTrangThai() == STATUS_DA_DUYET) {
            for (ChiTietPhieuXuat ct : phieuXuat.getChiTiet()) {
                capNhatTonKhoTheoLo(phieuXuat.getMaKho(), ct.getMaSP(), ct.getSoLo(), ct.getSoLuong());
            }
        }

        chiTietPhieuXuatRepository.deleteByMaPhieuXuat(maPhieuXuat);
        phieuXuatRepository.deleteById(maPhieuXuat);

        logActivity(nguoiXoa.getMaNguoiDung(), "Xóa Phiếu Xuất Hàng #" + maPhieuXuat);
    }

    // =================================================================
    // HÀM TIỆN ÍCH (HELPER)
    // =================================================================

    // [MỚI] Kiểm tra tồn kho của 1 lô cụ thể
    private void checkTonKhoLoHang(Integer maKho, Integer maSP, String soLo, Integer soLuongCan) {
        String sql = "SELECT SoLuongTon FROM chitietkho WHERE MaKho = ? AND MaSP = ? AND SoLo = ?";
        try {
            Integer ton = jdbcTemplate.queryForObject(sql, Integer.class, maKho, maSP, soLo);
            if (ton == null || ton < soLuongCan) {
                throw new RuntimeException("Lô hàng " + soLo + " không đủ số lượng để xuất.");
            }
        } catch (EmptyResultDataAccessException e) {
            throw new RuntimeException("Lô hàng " + soLo + " không tồn tại trong kho này.");
        }
    }

    // [MỚI] Cập nhật tồn kho theo lô (Batch)
    private void capNhatTonKhoTheoLo(Integer maKho, Integer maSP, String soLo, Integer soLuongThayDoi) {
        // 1. Cập nhật bảng ChiTietKho (Theo Lô)
        String sqlUpdateKho = "UPDATE chitietkho SET SoLuongTon = SoLuongTon + ? WHERE MaKho = ? AND MaSP = ? AND SoLo = ?";
        int rows = jdbcTemplate.update(sqlUpdateKho, soLuongThayDoi, maKho, maSP, soLo);

        if (rows == 0 && soLuongThayDoi < 0) {
            throw new RuntimeException("Lỗi nghiêm trọng: Không tìm thấy lô hàng để trừ kho!");
        }

        // 2. Cập nhật bảng SanPham (Tổng tồn kho toàn hệ thống) - Để đồng bộ
        SanPham sp = sanPhamRepository.findById(maSP).orElseThrow();
        int tongHienTai = (sp.getSoLuongTon() == null) ? 0 : sp.getSoLuongTon();
        sp.setSoLuongTon(tongHienTai + soLuongThayDoi);
        sanPhamRepository.update(sp);
    }

    // Các hàm khác giữ nguyên
    public PhieuXuatHang getPhieuXuatById(Integer id) {
        PhieuXuatHang pxh = phieuXuatRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu xuất " + id));
        pxh.setChiTiet(chiTietPhieuXuatRepository.findByMaPhieuXuat(id));
        return pxh;
    }

    public List<PhieuXuatHang> getAllPhieuXuat() {
        return phieuXuatRepository.findAll();
    }

    public List<PhieuXuatHang> filter(PhieuXuatFilterRequest request) {
        return phieuXuatRepository.filter(request);
    }

    @Transactional
    public PhieuXuatHang createPhieuXuatForGiangVien(PhieuXuatRequest request, String username) {
        NguoiDung giangVienUser = nguoiDungRepository.findByTenDangNhap(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Integer maKhachHang = findOrCreateCustomerFromUser(giangVienUser);
        request.setMaKH(maKhachHang);
        return createPhieuXuat(request, username);
    }

    private Integer findOrCreateCustomerFromUser(NguoiDung user) {
        List<KhachHang> existing = khachHangRepository.search(user.getEmail());
        if (!existing.isEmpty()) {
            return existing.get(0).getMaKH();
        }
        KhachHang newCus = new KhachHang();
        newCus.setTenKH(user.getHoTen() + " (GV)");
        newCus.setEmail(user.getEmail());
        newCus.setSdt(user.getSdt());
        newCus.setDiaChi("Trường học");
        return khachHangRepository.save(newCus);
    }

    public List<PhieuXuatHang> getAllPhieuXuat(String username) {
        NguoiDung user = nguoiDungRepository.findByTenDangNhap(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        int roleId = user.getVaiTro().getMaVaiTro();
        if (roleId == 1 || roleId == 2 || roleId == 3 || roleId == 4) {
            return phieuXuatRepository.findAll();
        } else {
            return phieuXuatRepository.findByNguoiLap(user.getMaNguoiDung());
        }
    }

    private void logActivity(Integer maUser, String act) {
        HoatDong hd = new HoatDong();
        hd.setMaNguoiDung(maUser);
        hd.setHanhDong(act);
        hd.setThoiGianThucHien(java.time.LocalDateTime.now());
        hoatDongRepository.save(hd);
    }
}