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
    private final JdbcTemplate jdbcTemplate;

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
    // 1. CREATE (Tạo phiếu - ĐÃ SỬA LOGIC PENDING)
    // =================================================================
    @Transactional
    public PhieuXuatHang createPhieuXuat(PhieuXuatRequest request, String tenNguoiLap) {
        NguoiDung nguoiLap = nguoiDungRepository.findByTenDangNhap(tenNguoiLap)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng."));

        // 1. Kiểm tra tồn kho (Chỉ check nếu có nhập Lô cụ thể)
        for (ChiTietPhieuXuatRequest item : request.getChiTiet()) {
            if (item.getSoLo() != null && !item.getSoLo().trim().isEmpty()) {
                checkTonKhoLoHang(request.getMaKho(), item.getMaSP(), item.getSoLo(), item.getSoLuong());
            }
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

        // 4. Lưu Chi Tiết
        for (ChiTietPhieuXuatRequest ctRequest : request.getChiTiet()) {
            ChiTietPhieuXuat chiTiet = new ChiTietPhieuXuat();
            chiTiet.setMaPhieuXuat(maPhieuXuatMoi);
            chiTiet.setMaSP(ctRequest.getMaSP());
            chiTiet.setSoLuong(ctRequest.getSoLuong());
            chiTiet.setDonGia(ctRequest.getDonGia());
            chiTiet.setThanhTien(ctRequest.getDonGia().multiply(new BigDecimal(ctRequest.getSoLuong())));

            // [QUAN TRỌNG] Xử lý logic PENDING để tránh lỗi khóa chính DB
            if (ctRequest.getSoLo() == null || ctRequest.getSoLo().trim().isEmpty()) {
                chiTiet.setSoLo("PENDING"); // Gán giá trị tạm
            } else {
                chiTiet.setSoLo(ctRequest.getSoLo());
            }

            chiTietPhieuXuatRepository.save(chiTiet);
        }

        logActivity(nguoiLap.getMaNguoiDung(), "Tạo Phiếu Xuất Hàng #" + maPhieuXuatMoi);
        return getPhieuXuatById(maPhieuXuatMoi);
    }

    // =================================================================
    // 2. APPROVE (Duyệt - FEFO & XÓA PENDING)
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
        List<ChiTietPhieuXuat> listChiTietCu = phieuXuat.getChiTiet();

        for (ChiTietPhieuXuat ct : listChiTietCu) {
            // Trường hợp A: Đã có số lô cụ thể (Khác PENDING và khác null)
            if (ct.getSoLo() != null && !ct.getSoLo().equals("PENDING") && !ct.getSoLo().isEmpty()) {
                validateAndDeductSpecificBatch(phieuXuat.getMaKho(), ct, homNay);
            }
            // Trường hợp B: Chưa có số lô (PENDING) -> Auto FEFO
            else {
                autoAllocateBatches(phieuXuat, ct);

                // [QUAN TRỌNG] Xóa dòng 'PENDING' sau khi đã tách lô
                deleteOldGenericItem(ct.getMaPhieuXuat(), ct.getMaSP());
            }
        }

        phieuXuat.setTrangThai(STATUS_DA_DUYET);
        phieuXuat.setNguoiDuyet(nguoiDuyet.getMaNguoiDung());
        phieuXuatRepository.update(phieuXuat);

        logActivity(nguoiDuyet.getMaNguoiDung(), "Duyệt Phiếu Xuất #" + id);
        return getPhieuXuatById(id);
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
            throw new RuntimeException("Không thể hủy phiếu đã duyệt.");
        }

        phieuXuat.setTrangThai(STATUS_DA_HUY);
        phieuXuat.setNguoiDuyet(nguoiHuy.getMaNguoiDung());
        phieuXuatRepository.update(phieuXuat);

        logActivity(nguoiHuy.getMaNguoiDung(), "Hủy Phiếu Xuất #" + id);
        return phieuXuat;
    }

    // =================================================================
    // 4. UPDATE (Sửa phiếu)
    // =================================================================
    @Transactional
    public PhieuXuatHang updatePhieuXuat(Integer maPhieuXuat, PhieuXuatRequest request, String tenNguoiSua) {
        NguoiDung nguoiSua = nguoiDungRepository.findByTenDangNhap(tenNguoiSua)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng."));

        PhieuXuatHang phieuXuatCu = getPhieuXuatById(maPhieuXuat);

        if (phieuXuatCu.getTrangThai() == STATUS_DA_HUY) throw new RuntimeException("Không thể sửa phiếu đã hủy.");
        if (phieuXuatCu.getNgayLapPhieu().isBefore(LocalDateTime.now().minusDays(30))) throw new RuntimeException("Không thể sửa phiếu quá 30 ngày.");

        // Nếu ĐÃ DUYỆT -> Rollback kho
        if (phieuXuatCu.getTrangThai() == STATUS_DA_DUYET) {
            boolean hasPerm = SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals("PERM_PHIEUXUAT_EDIT_APPROVED"));
            if (!hasPerm) throw new RuntimeException("Bạn không có quyền sửa phiếu xuất đã duyệt.");

            for (ChiTietPhieuXuat ctCu : phieuXuatCu.getChiTiet()) {
                if(ctCu.getSoLo() != null && !ctCu.getSoLo().equals("PENDING")) {
                    capNhatTonKhoTheoLo(phieuXuatCu.getMaKho(), ctCu.getMaSP(), ctCu.getSoLo(), ctCu.getSoLuong());
                }
            }
        }

        // Xóa chi tiết cũ
        chiTietPhieuXuatRepository.deleteByMaPhieuXuat(maPhieuXuat);

        // Update thông tin chính
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
            if (ctRequest.getSoLo() != null && !ctRequest.getSoLo().isEmpty()) {
                checkTonKhoLoHang(request.getMaKho(), ctRequest.getMaSP(), ctRequest.getSoLo(), ctRequest.getSoLuong());
            }

            ChiTietPhieuXuat chiTietMoi = new ChiTietPhieuXuat();
            chiTietMoi.setMaPhieuXuat(maPhieuXuat);
            chiTietMoi.setMaSP(ctRequest.getMaSP());
            chiTietMoi.setSoLuong(ctRequest.getSoLuong());
            chiTietMoi.setDonGia(ctRequest.getDonGia());
            chiTietMoi.setThanhTien(ctRequest.getDonGia().multiply(new BigDecimal(ctRequest.getSoLuong())));

            // Xử lý PENDING khi update
            if (ctRequest.getSoLo() == null || ctRequest.getSoLo().trim().isEmpty()) {
                chiTietMoi.setSoLo("PENDING");
            } else {
                chiTietMoi.setSoLo(ctRequest.getSoLo());
            }

            chiTietPhieuXuatRepository.save(chiTietMoi);

            // Nếu đang là Đã Duyệt -> Trừ kho lại
            if (phieuXuatCu.getTrangThai() == STATUS_DA_DUYET) {
                if (ctRequest.getSoLo() != null && !ctRequest.getSoLo().equals("PENDING")) {
                    capNhatTonKhoTheoLo(request.getMaKho(), ctRequest.getMaSP(), ctRequest.getSoLo(), -ctRequest.getSoLuong());
                } else {
                    throw new RuntimeException("Khi sửa phiếu ĐÃ DUYỆT, bạn phải chọn Số Lô cụ thể.");
                }
            }
        }

        logActivity(nguoiSua.getMaNguoiDung(), "Cập nhật Phiếu Xuất Hàng #" + maPhieuXuat);
        return getPhieuXuatById(maPhieuXuat);
    }

    // =================================================================
    // 5. DELETE (Xóa phiếu)
    // =================================================================
    @Transactional
    public void deletePhieuXuat(Integer maPhieuXuat, String tenNguoiXoa) {
        NguoiDung nguoiXoa = nguoiDungRepository.findByTenDangNhap(tenNguoiXoa)
                .orElseThrow(() -> new RuntimeException("User not found"));
        PhieuXuatHang phieuXuat = getPhieuXuatById(maPhieuXuat);

        if (phieuXuat.getTrangThai() == STATUS_DA_DUYET) {
            for (ChiTietPhieuXuat ct : phieuXuat.getChiTiet()) {
                if(ct.getSoLo() != null && !ct.getSoLo().equals("PENDING")) {
                    capNhatTonKhoTheoLo(phieuXuat.getMaKho(), ct.getMaSP(), ct.getSoLo(), ct.getSoLuong());
                }
            }
        }
        chiTietPhieuXuatRepository.deleteByMaPhieuXuat(maPhieuXuat);
        phieuXuatRepository.deleteById(maPhieuXuat);
        logActivity(nguoiXoa.getMaNguoiDung(), "Xóa Phiếu Xuất Hàng #" + maPhieuXuat);
    }

    // =================================================================
    // HELPER FUNCTIONS
    // =================================================================

    private void checkTonKhoLoHang(Integer maKho, Integer maSP, String soLo, Integer soLuongCan) {
        String sql = "SELECT SoLuongTon FROM chitietkho WHERE MaKho = ? AND MaSP = ? AND SoLo = ?";
        try {
            Integer ton = jdbcTemplate.queryForObject(sql, Integer.class, maKho, maSP, soLo);
            if (ton == null || ton < soLuongCan) throw new RuntimeException("Lô " + soLo + " không đủ số lượng.");
        } catch (EmptyResultDataAccessException e) {
            throw new RuntimeException("Lô " + soLo + " không tồn tại trong kho.");
        }
    }

    private void capNhatTonKhoTheoLo(Integer maKho, Integer maSP, String soLo, Integer soLuongThayDoi) {
        String sqlUpdateKho = "UPDATE chitietkho SET SoLuongTon = SoLuongTon + ? WHERE MaKho = ? AND MaSP = ? AND SoLo = ?";
        int rows = jdbcTemplate.update(sqlUpdateKho, soLuongThayDoi, maKho, maSP, soLo);
        if (rows == 0 && soLuongThayDoi < 0) throw new RuntimeException("Lỗi: Không tìm thấy lô " + soLo + " để trừ kho!");

        SanPham sp = sanPhamRepository.findById(maSP).orElseThrow();
        int tong = (sp.getSoLuongTon() == null ? 0 : sp.getSoLuongTon()) + soLuongThayDoi;
        sp.setSoLuongTon(tong);
        sanPhamRepository.update(sp);
    }

    private void validateAndDeductSpecificBatch(Integer maKho, ChiTietPhieuXuat ct, LocalDate homNay) {
        String sqlCheck = "SELECT SoLuongTon, NgayHetHan FROM chitietkho WHERE MaKho = ? AND MaSP = ? AND SoLo = ?";
        try {
            Map<String, Object> info = jdbcTemplate.queryForMap(sqlCheck, maKho, ct.getMaSP(), ct.getSoLo());
            int ton = (Integer) info.get("SoLuongTon");
            java.sql.Date sqlDate = (java.sql.Date) info.get("NgayHetHan");
            LocalDate han = (sqlDate != null) ? sqlDate.toLocalDate() : null;

            if (ton < ct.getSoLuong()) throw new RuntimeException("Lô " + ct.getSoLo() + " thiếu hàng.");
            if (han != null && han.isBefore(homNay)) throw new RuntimeException("CHẶN: Lô " + ct.getSoLo() + " đã hết hạn.");

            capNhatTonKhoTheoLo(maKho, ct.getMaSP(), ct.getSoLo(), -ct.getSoLuong());
        } catch (EmptyResultDataAccessException e) {
            throw new RuntimeException("Lô " + ct.getSoLo() + " không tồn tại.");
        }
    }

    private void autoAllocateBatches(PhieuXuatHang phieu, ChiTietPhieuXuat yeuCau) {
        int soLuongCan = yeuCau.getSoLuong();
        List<Map<String, Object>> batches = findBatchesForAutoPick(phieu.getMaKho(), yeuCau.getMaSP());

        int tongTon = batches.stream().mapToInt(b -> (int)b.get("SoLuongTon")).sum();
        if (tongTon < soLuongCan) throw new RuntimeException("SP " + yeuCau.getMaSP() + ": Tổng tồn kho không đủ (Cần " + soLuongCan + ", Có " + tongTon + ")");

        for (Map<String, Object> batch : batches) {
            if (soLuongCan <= 0) break;
            String soLo = (String) batch.get("SoLo");
            int tonLo = (int) batch.get("SoLuongTon");
            int layTuLoNay = Math.min(soLuongCan, tonLo);

            capNhatTonKhoTheoLo(phieu.getMaKho(), yeuCau.getMaSP(), soLo, -layTuLoNay);

            ChiTietPhieuXuat newItem = new ChiTietPhieuXuat();
            newItem.setMaPhieuXuat(phieu.getMaPhieuXuat());
            newItem.setMaSP(yeuCau.getMaSP());
            newItem.setSoLuong(layTuLoNay);
            newItem.setDonGia(yeuCau.getDonGia());
            newItem.setThanhTien(yeuCau.getDonGia().multiply(new BigDecimal(layTuLoNay)));
            newItem.setSoLo(soLo);
            chiTietPhieuXuatRepository.save(newItem);

            soLuongCan -= layTuLoNay;
        }
    }

    private List<Map<String, Object>> findBatchesForAutoPick(Integer maKho, Integer maSP) {
        String sql = """
            SELECT SoLo, SoLuongTon, NgayHetHan 
            FROM chitietkho 
            WHERE MaKho = ? AND MaSP = ? 
              AND SoLuongTon > 0 
              AND (NgayHetHan IS NULL OR NgayHetHan >= CURDATE()) 
            ORDER BY CASE WHEN NgayHetHan IS NULL THEN 1 ELSE 0 END, NgayHetHan ASC
        """;
        return jdbcTemplate.queryForList(sql, maKho, maSP);
    }

    private void deleteOldGenericItem(Integer maPhieu, Integer maSP) {
        // [QUAN TRỌNG] Xóa dòng PENDING (thay vì null)
        String sql = "DELETE FROM chitietphieuxuat WHERE MaPhieuXuat = ? AND MaSP = ? AND SoLo = 'PENDING'";
        jdbcTemplate.update(sql, maPhieu, maSP);
    }

    // Các hàm Get/Filter
    public PhieuXuatHang getPhieuXuatById(Integer id) {
        PhieuXuatHang pxh = phieuXuatRepository.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu " + id));
        pxh.setChiTiet(chiTietPhieuXuatRepository.findByMaPhieuXuat(id));
        return pxh;
    }
    public List<PhieuXuatHang> getAllPhieuXuat() { return phieuXuatRepository.findAll(); }
    public List<PhieuXuatHang> filter(PhieuXuatFilterRequest request) { return phieuXuatRepository.filter(request); }
    public List<PhieuXuatHang> getAllPhieuXuat(String username) {
        NguoiDung user = nguoiDungRepository.findByTenDangNhap(username).orElseThrow();
        int r = user.getVaiTro().getMaVaiTro();
        return (r >= 1 && r <= 4) ? phieuXuatRepository.findAll() : phieuXuatRepository.findByNguoiLap(user.getMaNguoiDung());
    }

    @Transactional
    public PhieuXuatHang createPhieuXuatForGiangVien(PhieuXuatRequest request, String username) {
        NguoiDung u = nguoiDungRepository.findByTenDangNhap(username).orElseThrow();
        request.setMaKH(findOrCreateCustomerFromUser(u));
        return createPhieuXuat(request, username);
    }

    private Integer findOrCreateCustomerFromUser(NguoiDung user) {
        List<KhachHang> ex = khachHangRepository.search(user.getEmail());
        if (!ex.isEmpty()) return ex.get(0).getMaKH();
        KhachHang c = new KhachHang();
        c.setTenKH(user.getHoTen() + " (GV)");
        c.setEmail(user.getEmail());
        c.setSdt(user.getSdt());
        c.setDiaChi("Trường học");
        return khachHangRepository.save(c);
    }

    private void logActivity(Integer maUser, String act) {
        HoatDong hd = new HoatDong();
        hd.setMaNguoiDung(maUser);
        hd.setHanhDong(act);
        hd.setThoiGianThucHien(java.time.LocalDateTime.now());
        hoatDongRepository.save(hd);
    }
}