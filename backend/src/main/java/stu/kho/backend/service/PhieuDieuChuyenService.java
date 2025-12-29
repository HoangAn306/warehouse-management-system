package stu.kho.backend.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import stu.kho.backend.dto.PhieuDieuChuyenFilterRequest;
import stu.kho.backend.dto.PhieuDieuChuyenRequest;
import stu.kho.backend.entity.*;
import stu.kho.backend.repository.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class PhieuDieuChuyenService {

    private static final int STATUS_CHO_DUYET = 1;
    private static final int STATUS_DA_DUYET = 2;
    private static final int STATUS_DA_HUY = 3;

    private final PhieuDieuChuyenRepository phieuDieuChuyenRepo;
    private final ChiTietDieuChuyenRepository chiTietDieuChuyenRepo;
    private final ChiTietKhoRepository chiTietKhoRepo;
    private final SanPhamRepository sanPhamRepo;
    private final NguoiDungRepository nguoiDungRepo;
    private final HoatDongRepository hoatDongRepo;
    private final JdbcTemplate jdbcTemplate; // [MỚI] Cần để xử lý Lô

    public PhieuDieuChuyenService(PhieuDieuChuyenRepository phieuDieuChuyenRepo,
                                  ChiTietDieuChuyenRepository chiTietDieuChuyenRepo,
                                  ChiTietKhoRepository chiTietKhoRepo,
                                  SanPhamRepository sanPhamRepo,
                                  NguoiDungRepository nguoiDungRepo,
                                  HoatDongRepository hoatDongRepo,
                                  JdbcTemplate jdbcTemplate) {
        this.phieuDieuChuyenRepo = phieuDieuChuyenRepo;
        this.chiTietDieuChuyenRepo = chiTietDieuChuyenRepo;
        this.chiTietKhoRepo = chiTietKhoRepo;
        this.sanPhamRepo = sanPhamRepo;
        this.nguoiDungRepo = nguoiDungRepo;
        this.hoatDongRepo = hoatDongRepo;
        this.jdbcTemplate = jdbcTemplate;
    }

    // =================================================================
    // 1. CREATE (Tạo phiếu)
    // =================================================================
    @Transactional
    public PhieuDieuChuyen create(PhieuDieuChuyenRequest req, String username) {
        NguoiDung user = nguoiDungRepo.findByTenDangNhap(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));

        if (req.getMaKhoXuat().equals(req.getMaKhoNhap())) {
            throw new RuntimeException("Kho xuất và Kho nhập không được trùng nhau.");
        }

        // Validate sơ bộ tồn kho (Chỉ check nếu user CÓ chọn lô)
        for (var item : req.getChiTiet()) {
            if (item.getSoLo() != null && !item.getSoLo().isEmpty()) {
                checkTonKhoTaiKhoXuat(req.getMaKhoXuat(), item.getMaSP(), item.getSoLo(), item.getSoLuong());
            }
        }

        PhieuDieuChuyen pdc = new PhieuDieuChuyen();
        pdc.setMaKhoXuat(req.getMaKhoXuat());
        pdc.setMaKhoNhap(req.getMaKhoNhap());
        pdc.setNguoiLap(user.getMaNguoiDung());
        pdc.setGhiChu(req.getGhiChu());
        pdc.setChungTu(req.getChungTu());
        pdc.setNgayChuyen(req.getNgayChuyen() != null ? req.getNgayChuyen() : LocalDateTime.now());
        pdc.setTrangThai(STATUS_CHO_DUYET);

        int id = phieuDieuChuyenRepo.save(pdc);
        pdc.setMaPhieuDC(id);

        for (var item : req.getChiTiet()) {
            ChiTietDieuChuyen ct = new ChiTietDieuChuyen();
            ct.setMaPhieuDC(id);
            ct.setMaSP(item.getMaSP());
            ct.setSoLuong(item.getSoLuong());

            // [MỚI] Lưu lô hàng (Nếu null thì lưu PENDING hoặc null tùy DB, ở đây giả sử lưu đúng giá trị gửi lên)
            ct.setSoLo(item.getSoLo());

            chiTietDieuChuyenRepo.save(ct);
        }

        logActivity(user.getMaNguoiDung(), "Tạo phiếu điều chuyển #" + id);
        return getById(id);
    }

    // =================================================================
    // 2. APPROVE (Duyệt - LOGIC QUAN TRỌNG NHẤT)
    // =================================================================
    @Transactional
    public PhieuDieuChuyen approve(Integer id, String username) {
        NguoiDung user = nguoiDungRepo.findByTenDangNhap(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        PhieuDieuChuyen pdc = getById(id);

        if (pdc.getTrangThai() != STATUS_CHO_DUYET) {
            throw new RuntimeException("Chỉ duyệt được phiếu đang chờ.");
        }

        List<ChiTietDieuChuyen> listChiTiet = pdc.getChiTiet();

        for (ChiTietDieuChuyen ct : listChiTiet) {

            // Case A: Đã chỉ định lô cụ thể
            if (ct.getSoLo() != null && !ct.getSoLo().isEmpty()) {
                transferSpecificBatch(pdc, ct);
            }
            // Case B: Không chỉ định lô -> Auto FEFO
            else {
                autoTransferBatches(pdc, ct);
                // Xóa dòng chung chung (null/empty) sau khi đã tách lô
                deleteOldGenericItem(pdc.getMaPhieuDC(), ct.getMaSP());
            }
        }

        pdc.setTrangThai(STATUS_DA_DUYET);
        pdc.setNguoiDuyet(user.getMaNguoiDung());
        phieuDieuChuyenRepo.update(pdc);

        logActivity(user.getMaNguoiDung(), "Duyệt phiếu điều chuyển #" + id);
        return getById(id); // Return lại để thấy chi tiết lô đã tách
    }

    // =================================================================
    // 3. CANCEL (Hủy)
    // =================================================================
    @Transactional
    public PhieuDieuChuyen cancel(Integer id, String username) {
        NguoiDung user = nguoiDungRepo.findByTenDangNhap(username).orElseThrow();
        PhieuDieuChuyen pdc = getById(id);

        if (pdc.getTrangThai() == STATUS_DA_HUY) throw new RuntimeException("Phiếu này đã hủy rồi.");

        // Nếu đã duyệt -> Hoàn kho (Rollback)
        if (pdc.getTrangThai() == STATUS_DA_DUYET) {
            for (ChiTietDieuChuyen ct : pdc.getChiTiet()) {
                if (ct.getSoLo() != null) { // Chỉ rollback những dòng có lô cụ thể
                    rollbackTransfer(pdc, ct);
                }
            }
        }

        pdc.setTrangThai(STATUS_DA_HUY);
        pdc.setNguoiDuyet(user.getMaNguoiDung());
        phieuDieuChuyenRepo.update(pdc);

        logActivity(user.getMaNguoiDung(), "Hủy phiếu điều chuyển #" + id);
        return pdc;
    }

    // =================================================================
    // 4. UPDATE (Sửa)
    // =================================================================
    @Transactional
    public PhieuDieuChuyen update(Integer id, PhieuDieuChuyenRequest req, String username) {
        NguoiDung user = nguoiDungRepo.findByTenDangNhap(username).orElseThrow();
        PhieuDieuChuyen pdc = getById(id);

        if (pdc.getTrangThai() == STATUS_DA_HUY) throw new RuntimeException("Không thể sửa phiếu đã hủy.");

        // Check thời gian 30 ngày
        LocalDateTime ngayCheck = pdc.getNgayChuyen() != null ? pdc.getNgayChuyen() : LocalDateTime.now();
        if (ngayCheck.isBefore(LocalDateTime.now().minusDays(30))) {
            throw new RuntimeException("Không thể sửa phiếu đã quá hạn 30 ngày.");
        }

        // Nếu ĐÃ DUYỆT -> Rollback kho trước
        if (pdc.getTrangThai() == STATUS_DA_DUYET) {
            // ... (Check quyền ở đây nếu cần) ...
            for (var item : pdc.getChiTiet()) {
                if (item.getSoLo() != null) rollbackTransfer(pdc, item);
            }
        }

        // Xóa chi tiết cũ
        chiTietDieuChuyenRepo.deleteByMaPhieuDC(id);

        // Update Master
        if (!req.getMaKhoXuat().equals(pdc.getMaKhoXuat()) || !req.getMaKhoNhap().equals(pdc.getMaKhoNhap())) {
            if (req.getMaKhoXuat().equals(req.getMaKhoNhap())) throw new RuntimeException("Kho trùng nhau.");
            pdc.setMaKhoXuat(req.getMaKhoXuat());
            pdc.setMaKhoNhap(req.getMaKhoNhap());
        }
        pdc.setGhiChu(req.getGhiChu());
        pdc.setChungTu(req.getChungTu());
        pdc.setNgayChuyen(req.getNgayChuyen());
        phieuDieuChuyenRepo.update(pdc);

        // Thêm chi tiết MỚI
        for (var item : req.getChiTiet()) {
            // Check tồn kho nếu có lô
            if (item.getSoLo() != null && !item.getSoLo().isEmpty()) {
                checkTonKhoTaiKhoXuat(pdc.getMaKhoXuat(), item.getMaSP(), item.getSoLo(), item.getSoLuong());
            }

            ChiTietDieuChuyen ct = new ChiTietDieuChuyen();
            ct.setMaPhieuDC(id);
            ct.setMaSP(item.getMaSP());
            ct.setSoLuong(item.getSoLuong());
            ct.setSoLo(item.getSoLo()); // [MỚI]
            chiTietDieuChuyenRepo.save(ct);

            // Nếu đang là ĐÃ DUYỆT -> Thực hiện chuyển kho lại ngay (Chỉ hỗ trợ có Lô)
            if (pdc.getTrangThai() == STATUS_DA_DUYET) {
                if (item.getSoLo() != null && !item.getSoLo().isEmpty()) {
                    transferSpecificBatch(pdc, ct);
                } else {
                    throw new RuntimeException("Khi sửa phiếu ĐÃ DUYỆT, bắt buộc phải chọn Số Lô.");
                }
            }
        }

        logActivity(user.getMaNguoiDung(), "Cập nhật phiếu điều chuyển #" + id);
        return getById(id);
    }

    // =================================================================
    // 5. DELETE (Xóa)
    // =================================================================
    @Transactional
    public void delete(Integer id, String username) {
        NguoiDung user = nguoiDungRepo.findByTenDangNhap(username).orElseThrow();
        PhieuDieuChuyen pdc = getById(id);

        // Nếu ĐÃ DUYỆT -> Hoàn kho
        if (pdc.getTrangThai() == STATUS_DA_DUYET) {
            for (var item : pdc.getChiTiet()) {
                if (item.getSoLo() != null) rollbackTransfer(pdc, item);
            }
        }

        chiTietDieuChuyenRepo.deleteByMaPhieuDC(id);
        phieuDieuChuyenRepo.deleteById(id);
        logActivity(user.getMaNguoiDung(), "Xóa phiếu điều chuyển #" + id);
    }

    // =================================================================
    // CÁC HÀM LOGIC KHO (PRIVATE - CORE LOGIC)
    // =================================================================

    // 1. Chuyển 1 lô cụ thể
    private void transferSpecificBatch(PhieuDieuChuyen pdc, ChiTietDieuChuyen ct) {
        // Lấy thông tin lô từ Kho Xuất
        String sql = "SELECT NgayHetHan, SoLuongTon FROM chitietkho WHERE MaKho = ? AND MaSP = ? AND SoLo = ?";
        Map<String, Object> info = jdbcTemplate.queryForMap(sql, pdc.getMaKhoXuat(), ct.getMaSP(), ct.getSoLo());

        int ton = (Integer) info.get("SoLuongTon");
        java.sql.Date sqlDate = (java.sql.Date) info.get("NgayHetHan");
        LocalDate han = (sqlDate != null) ? sqlDate.toLocalDate() : null;

        if (ton < ct.getSoLuong()) throw new RuntimeException("Lô " + ct.getSoLo() + " tại kho xuất không đủ hàng.");

        // A. Trừ Kho Xuất
        capNhatTonKhoTheoLo(pdc.getMaKhoXuat(), ct.getMaSP(), ct.getSoLo(), -ct.getSoLuong());

        // B. Cộng Kho Nhập (Mang theo Hạn sử dụng)
        chiTietKhoRepo.upsertTonKho(pdc.getMaKhoNhap(), ct.getMaSP(), ct.getSoLo(), han, ct.getSoLuong());

        // Cập nhật lại hạn vào chi tiết phiếu (để lưu vết)
        ct.setNgayHetHan(han);
        // TODO: Update lại dòng chi tiết trong DB nếu cần lưu ngày hết hạn vào bảng chitietdieuchuyen
    }

    // 2. Tự động tìm lô (FEFO) và chuyển
    private void autoTransferBatches(PhieuDieuChuyen pdc, ChiTietDieuChuyen yeuCau) {
        int soLuongCan = yeuCau.getSoLuong();
        // Lấy danh sách lô ở Kho Xuất (Sắp xếp cũ -> mới)
        List<Map<String, Object>> batches = findBatchesForAutoPick(pdc.getMaKhoXuat(), yeuCau.getMaSP());

        int tongTon = batches.stream().mapToInt(b -> (int)b.get("SoLuongTon")).sum();
        if (tongTon < soLuongCan) throw new RuntimeException("Kho xuất không đủ hàng (Cần: " + soLuongCan + ", Có: " + tongTon + ")");

        for (Map<String, Object> batch : batches) {
            if (soLuongCan <= 0) break;

            String soLo = (String) batch.get("SoLo");
            int tonLo = (int) batch.get("SoLuongTon");
            java.sql.Date sqlDate = (java.sql.Date) batch.get("NgayHetHan");
            LocalDate han = (sqlDate != null) ? sqlDate.toLocalDate() : null;

            int layTuLoNay = Math.min(soLuongCan, tonLo);

            // A. Trừ Kho Xuất
            capNhatTonKhoTheoLo(pdc.getMaKhoXuat(), yeuCau.getMaSP(), soLo, -layTuLoNay);

            // B. Cộng Kho Nhập
            chiTietKhoRepo.upsertTonKho(pdc.getMaKhoNhap(), yeuCau.getMaSP(), soLo, han, layTuLoNay);

            // C. Tạo dòng chi tiết mới (Cụ thể hóa lô)
            ChiTietDieuChuyen newItem = new ChiTietDieuChuyen();
            newItem.setMaPhieuDC(pdc.getMaPhieuDC());
            newItem.setMaSP(yeuCau.getMaSP());
            newItem.setSoLuong(layTuLoNay);
            newItem.setSoLo(soLo);
            newItem.setNgayHetHan(han);
            chiTietDieuChuyenRepo.save(newItem);

            soLuongCan -= layTuLoNay;
        }
    }

    // 3. Rollback (Dùng cho Hủy/Xóa phiếu đã duyệt)
    private void rollbackTransfer(PhieuDieuChuyen pdc, ChiTietDieuChuyen ct) {
        // Lấy hạn sử dụng từ Kho Nhập (để trả về Kho Xuất đúng hạn)
        String sql = "SELECT NgayHetHan FROM chitietkho WHERE MaKho = ? AND MaSP = ? AND SoLo = ?";
        // Lưu ý: Có thể lô ở kho nhập đã hết/biến mất, ta có thể lấy từ bảng chitietdieuchuyen nếu đã lưu,
        // hoặc query tạm. Ở đây giả sử lô vẫn còn vết ở kho nhập hoặc dùng ngày hết hạn đã lưu trong ct.
        LocalDate han = ct.getNgayHetHan();

        // Kiểm tra Kho Nhập có đủ hàng để trả lại không
        checkTonKhoTaiKhoXuat(pdc.getMaKhoNhap(), ct.getMaSP(), ct.getSoLo(), ct.getSoLuong());

        // Trừ Kho Nhập
        capNhatTonKhoTheoLo(pdc.getMaKhoNhap(), ct.getMaSP(), ct.getSoLo(), -ct.getSoLuong());

        // Cộng lại Kho Xuất
        chiTietKhoRepo.upsertTonKho(pdc.getMaKhoXuat(), ct.getMaSP(), ct.getSoLo(), han, ct.getSoLuong());
    }

    // --- HELPER SQL ---

    private void checkTonKhoTaiKhoXuat(Integer maKho, Integer maSP, String soLo, Integer soLuongCan) {
        String sql = "SELECT SoLuongTon FROM chitietkho WHERE MaKho = ? AND MaSP = ? AND SoLo = ?";
        try {
            Integer ton = jdbcTemplate.queryForObject(sql, Integer.class, maKho, maSP, soLo);
            if (ton == null || ton < soLuongCan) throw new RuntimeException("Lô " + soLo + " không đủ hàng.");
        } catch (Exception e) {
            throw new RuntimeException("Lô " + soLo + " không tồn tại ở kho xuất.");
        }
    }

    private void capNhatTonKhoTheoLo(Integer maKho, Integer maSP, String soLo, Integer soLuongThayDoi) {
        String sqlUpdate = "UPDATE chitietkho SET SoLuongTon = SoLuongTon + ? WHERE MaKho = ? AND MaSP = ? AND SoLo = ?";
        jdbcTemplate.update(sqlUpdate, soLuongThayDoi, maKho, maSP, soLo);
        // Lưu ý: Không update bảng SanPham vì tổng tồn kho toàn hệ thống không đổi khi điều chuyển
    }

    private List<Map<String, Object>> findBatchesForAutoPick(Integer maKho, Integer maSP) {
        String sql = """
            SELECT SoLo, SoLuongTon, NgayHetHan 
            FROM chitietkho 
            WHERE MaKho = ? AND MaSP = ? AND SoLuongTon > 0 
            ORDER BY CASE WHEN NgayHetHan IS NULL THEN 1 ELSE 0 END, NgayHetHan ASC
        """;
        return jdbcTemplate.queryForList(sql, maKho, maSP);
    }

    private void deleteOldGenericItem(Integer maPhieu, Integer maSP) {
        String sql = "DELETE FROM chitietdieuchuyen WHERE MaPhieuDC = ? AND MaSP = ? AND (SoLo IS NULL OR SoLo = '')";
        jdbcTemplate.update(sql, maPhieu, maSP);
    }

    // --- STANDARD METHODS ---
    public PhieuDieuChuyen getById(Integer id) {
        PhieuDieuChuyen pdc = phieuDieuChuyenRepo.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu #" + id));
        pdc.setChiTiet(chiTietDieuChuyenRepo.findByMaPhieuDC(id));
        return pdc;
    }
    public List<PhieuDieuChuyen> getAll() { return phieuDieuChuyenRepo.findAll(); }
    public List<PhieuDieuChuyen> filter(PhieuDieuChuyenFilterRequest request) { return phieuDieuChuyenRepo.filter(request); }

    private void logActivity(Integer maUser, String act) {
        HoatDong hd = new HoatDong();
        hd.setMaNguoiDung(maUser);
        hd.setHanhDong(act);
        hd.setThoiGianThucHien(java.time.LocalDateTime.now());
        hoatDongRepo.save(hd);
    }
}