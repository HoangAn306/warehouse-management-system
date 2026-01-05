package stu.kho.backend.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;

import stu.kho.backend.dto.PhieuDieuChuyenFilterRequest;
import stu.kho.backend.dto.PhieuDieuChuyenRequest;
import stu.kho.backend.entity.ChiTietDieuChuyen;
import stu.kho.backend.entity.HoatDong;
import stu.kho.backend.entity.KhoHang;
import stu.kho.backend.entity.NguoiDung;
import stu.kho.backend.entity.PhieuDieuChuyen;
import stu.kho.backend.repository.ChiTietDieuChuyenRepository;
import stu.kho.backend.repository.ChiTietKhoRepository;
import stu.kho.backend.repository.HoatDongRepository;
import stu.kho.backend.repository.KhoHangRepository;
import stu.kho.backend.repository.NguoiDungRepository;
import stu.kho.backend.repository.PhieuDieuChuyenRepository;
import stu.kho.backend.repository.SanPhamRepository;

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
    private final JdbcTemplate jdbcTemplate;
    private final KhoHangRepository khoHangRepository;


    public PhieuDieuChuyenService(PhieuDieuChuyenRepository phieuDieuChuyenRepo,
                                  ChiTietDieuChuyenRepository chiTietDieuChuyenRepo,
                                  ChiTietKhoRepository chiTietKhoRepo,
                                  SanPhamRepository sanPhamRepo,
                                  NguoiDungRepository nguoiDungRepo,
                                  HoatDongRepository hoatDongRepo,
                                  JdbcTemplate jdbcTemplate, KhoHangRepository khoHangRepository) {
        this.phieuDieuChuyenRepo = phieuDieuChuyenRepo;
        this.chiTietDieuChuyenRepo = chiTietDieuChuyenRepo;
        this.chiTietKhoRepo = chiTietKhoRepo;
        this.sanPhamRepo = sanPhamRepo;
        this.nguoiDungRepo = nguoiDungRepo;
        this.hoatDongRepo = hoatDongRepo;
        this.jdbcTemplate = jdbcTemplate;
        this.khoHangRepository = khoHangRepository;
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

        // Validate sơ bộ tồn kho (Chỉ check nếu user CÓ chọn lô cụ thể)
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

            // Nếu null hoặc rỗng thì gán PENDING để khớp logic DB (tránh lỗi duplicate key)
            if (item.getSoLo() == null || item.getSoLo().trim().isEmpty()) {
                ct.setSoLo("PENDING");
            } else {
                ct.setSoLo(item.getSoLo());
            }

            chiTietDieuChuyenRepo.save(ct);
        }

        logActivity(user.getMaNguoiDung(), "Tạo phiếu điều chuyển #" + id);
        return getById(id);
    }

    // =================================================================
    // 2. APPROVE (Duyệt - ĐÃ SỬA LỖI LOGIC PENDING)
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

            // [QUAN TRỌNG] SỬA LỖI TẠI ĐÂY
            // Chỉ coi là lô cụ thể khi khác null, khác rỗng VÀ KHÁC "PENDING"
            if (ct.getSoLo() != null && !ct.getSoLo().isEmpty() && !ct.getSoLo().equals("PENDING")) {
                transferSpecificBatch(pdc, ct);
            }
            // Trường hợp: PENDING hoặc Null -> Chạy Auto FEFO
            else {
                autoTransferBatches(pdc, ct);

                // Xóa dòng PENDING cũ đi sau khi đã tách lô thành công
                deleteOldGenericItem(pdc.getMaPhieuDC(), ct.getMaSP());
            }
        }

        pdc.setTrangThai(STATUS_DA_DUYET);
        pdc.setNguoiDuyet(user.getMaNguoiDung());
        phieuDieuChuyenRepo.update(pdc);

        logActivity(user.getMaNguoiDung(), "Duyệt phiếu điều chuyển #" + id);
        return getById(id);
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
                // Chỉ rollback những dòng có lô cụ thể (khác PENDING)
                if (ct.getSoLo() != null && !ct.getSoLo().equals("PENDING")) {
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

        LocalDateTime ngayCheck = pdc.getNgayChuyen() != null ? pdc.getNgayChuyen() : LocalDateTime.now();
        if (ngayCheck.isBefore(LocalDateTime.now().minusDays(30))) {
            throw new RuntimeException("Không thể sửa phiếu đã quá hạn 30 ngày.");
        }

        // Nếu ĐÃ DUYỆT -> Rollback kho trước
        if (pdc.getTrangThai() == STATUS_DA_DUYET) {
            for (var item : pdc.getChiTiet()) {
                if (item.getSoLo() != null && !item.getSoLo().equals("PENDING")) {
                    rollbackTransfer(pdc, item);
                }
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
            // Check tồn kho nếu có lô cụ thể
            if (item.getSoLo() != null && !item.getSoLo().isEmpty()) {
                checkTonKhoTaiKhoXuat(pdc.getMaKhoXuat(), item.getMaSP(), item.getSoLo(), item.getSoLuong());
            }

            ChiTietDieuChuyen ct = new ChiTietDieuChuyen();
            ct.setMaPhieuDC(id);
            ct.setMaSP(item.getMaSP());
            ct.setSoLuong(item.getSoLuong());

            // Xử lý PENDING khi update
            if (item.getSoLo() == null || item.getSoLo().trim().isEmpty()) {
                ct.setSoLo("PENDING");
            } else {
                ct.setSoLo(item.getSoLo());
            }

            chiTietDieuChuyenRepo.save(ct);

            // Nếu đang là ĐÃ DUYỆT -> Thực hiện chuyển kho lại ngay
            if (pdc.getTrangThai() == STATUS_DA_DUYET) {
                if (ct.getSoLo() != null && !ct.getSoLo().equals("PENDING")) {
                    transferSpecificBatch(pdc, ct);
                } else {
                    throw new RuntimeException("Khi sửa phiếu ĐÃ DUYỆT, bắt buộc phải chọn Số Lô cụ thể.");
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
                if (item.getSoLo() != null && !item.getSoLo().equals("PENDING")) {
                    rollbackTransfer(pdc, item);
                }
            }
        }

        chiTietDieuChuyenRepo.deleteByMaPhieuDC(id);
        phieuDieuChuyenRepo.deleteById(id);
        logActivity(user.getMaNguoiDung(), "Xóa phiếu điều chuyển #" + id);
    }

    // =================================================================
    // HELPER FUNCTIONS (CORE LOGIC)
    // =================================================================

    private void transferSpecificBatch(PhieuDieuChuyen pdc, ChiTietDieuChuyen ct) {
        String sql = "SELECT NgayHetHan, SoLuongTon FROM chitietkho WHERE MaKho = ? AND MaSP = ? AND SoLo = ?";
        Map<String, Object> info = jdbcTemplate.queryForMap(sql, pdc.getMaKhoXuat(), ct.getMaSP(), ct.getSoLo());

        int ton = (Integer) info.get("SoLuongTon");
        java.sql.Date sqlDate = (java.sql.Date) info.get("NgayHetHan");
        LocalDate han = (sqlDate != null) ? sqlDate.toLocalDate() : null;

        if (ton < ct.getSoLuong()) throw new RuntimeException("Lô " + ct.getSoLo() + " tại kho xuất không đủ hàng.");

        capNhatTonKhoTheoLo(pdc.getMaKhoXuat(), ct.getMaSP(), ct.getSoLo(), -ct.getSoLuong());
        chiTietKhoRepo.upsertTonKho(pdc.getMaKhoNhap(), ct.getMaSP(), ct.getSoLo(), han, ct.getSoLuong());

        ct.setNgayHetHan(han);
    }

    private void autoTransferBatches(PhieuDieuChuyen pdc, ChiTietDieuChuyen yeuCau) {
        int soLuongCan = yeuCau.getSoLuong();
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

            capNhatTonKhoTheoLo(pdc.getMaKhoXuat(), yeuCau.getMaSP(), soLo, -layTuLoNay);
            chiTietKhoRepo.upsertTonKho(pdc.getMaKhoNhap(), yeuCau.getMaSP(), soLo, han, layTuLoNay);

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

    private void rollbackTransfer(PhieuDieuChuyen pdc, ChiTietDieuChuyen ct) {
        String sql = "SELECT NgayHetHan FROM chitietkho WHERE MaKho = ? AND MaSP = ? AND SoLo = ?";
        // Lấy hạn sử dụng hiện tại ở kho nhập (hoặc dùng ct.getNgayHetHan() nếu đã lưu)
        LocalDate han = ct.getNgayHetHan();

        checkTonKhoTaiKhoXuat(pdc.getMaKhoNhap(), ct.getMaSP(), ct.getSoLo(), ct.getSoLuong());

        capNhatTonKhoTheoLo(pdc.getMaKhoNhap(), ct.getMaSP(), ct.getSoLo(), -ct.getSoLuong());
        chiTietKhoRepo.upsertTonKho(pdc.getMaKhoXuat(), ct.getMaSP(), ct.getSoLo(), han, ct.getSoLuong());
    }

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
        // [CẬP NHẬT] Xóa cả dòng PENDING
        String sql = "DELETE FROM chitietdieuchuyen WHERE MaPhieuDC = ? AND MaSP = ? AND (SoLo IS NULL OR SoLo = '' OR SoLo = 'PENDING')";
        jdbcTemplate.update(sql, maPhieu, maSP);
    }

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
    // =================================================================
    // TÍNH NĂNG IN PHIẾU ĐIỀU CHUYỂN (PDF)
    // =================================================================
    public byte[] exportPhieuDieuChuyenPdf(Integer id) throws DocumentException, IOException {
        // 1. Lấy dữ liệu
        PhieuDieuChuyen pdc = getById(id);
        KhoHang khoXuat = khoHangRepository.findById(pdc.getMaKhoXuat()).orElse(new KhoHang());
        KhoHang khoNhap = khoHangRepository.findById(pdc.getMaKhoNhap()).orElse(new KhoHang());
        List<ChiTietDieuChuyen> chiTietList = pdc.getChiTiet();

        // 2. Khởi tạo PDF
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4);
        PdfWriter.getInstance(document, out);
        document.open();

        // Font chữ
        BaseFont bf = BaseFont.createFont("fonts/times.ttf", BaseFont.IDENTITY_H, BaseFont.EMBEDDED); // Nếu có file font
        // BaseFont bf = BaseFont.createFont("fonts/arial.ttf", BaseFont.IDENTITY_H, BaseFont.EMBEDDED); // Nếu có font tiếng Việt

        Font fontTitle = new Font(bf, 18, Font.BOLD);
        Font fontBold = new Font(bf, 11, Font.BOLD);
        Font fontNormal = new Font(bf, 11, Font.NORMAL);

        // 3. Tiêu đề
        Paragraph title = new Paragraph("Phiếu Điều Chuyển", fontTitle);
        title.setAlignment(Element.ALIGN_CENTER);
        document.add(title);
        document.add(new Paragraph(" ", fontNormal));

        // 4. Thông tin chung (Từ Kho -> Đến Kho)
        PdfPTable infoTable = new PdfPTable(2);
        infoTable.setWidthPercentage(100);
        infoTable.setWidths(new float[]{1, 1}); // Chia đều 50-50

        // Cột trái
        PdfPCell cellLeft = new PdfPCell();
        cellLeft.setBorder(Rectangle.NO_BORDER);
        cellLeft.addElement(new Paragraph("Số Phiếu: #" + pdc.getMaPhieuDC(), fontBold));
        cellLeft.addElement(new Paragraph("Ngày Lập: " + pdc.getNgayChuyen().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")), fontNormal));
        cellLeft.addElement(new Paragraph("Lý Do: " + (pdc.getGhiChu() != null ? pdc.getGhiChu() : "Điều chuyển nội bộ"), fontNormal));
        infoTable.addCell(cellLeft);

        // Cột phải (Thông tin kho)
        PdfPCell cellRight = new PdfPCell();
        cellRight.setBorder(Rectangle.NO_BORDER);
        cellRight.addElement(new Paragraph("Từ kho (From): " + khoXuat.getTenKho(), fontNormal));
        cellRight.addElement(new Paragraph("Đến kho (To):   " + khoNhap.getTenKho(), fontBold)); // In đậm kho đến cho dễ nhìn
        infoTable.addCell(cellRight);

        document.add(infoTable);
        document.add(new Paragraph(" ", fontNormal));

        // 5. Bảng chi tiết
        // Cột: STT, Tên SP, ĐVT, Số Lô/Hạn, Số Lượng (Thường phiếu chuyển kho không để giá)
        PdfPTable table = new PdfPTable(5);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{0.8f, 4f, 1.5f, 2.5f, 1.5f});

        addCellToTable(table, "STT", fontBold, true);
        addCellToTable(table, "Tên Sản Phẩm", fontBold, true);
        addCellToTable(table, "DVT", fontBold, true);
        addCellToTable(table, "Số Lô / Hạn SD", fontBold, true); // Quan trọng để thủ kho lấy đúng hàng
        addCellToTable(table, "SL Chuyển", fontBold, true);

        int i = 1;
        DateTimeFormatter dateFmt = DateTimeFormatter.ofPattern("dd/MM/yy");

        for (ChiTietDieuChuyen ct : chiTietList) {
              String tenSP;
            String dvt;
            if (ct.getSanPham() != null) {
                tenSP = ct.getSanPham().getTenSP();
                dvt = ct.getSanPham().getDonViTinh();
            } else {
                tenSP = "SP #" + ct.getMaSP(); // Fallback
                dvt = "";
            }
            String loHan = "";
            if (ct.getSoLo() != null) loHan += "Lô: " + ct.getSoLo();
            if (ct.getNgayHetHan() != null) loHan += "\nHSD: " + ct.getNgayHetHan().format(dateFmt);

            addCellToTable(table, String.valueOf(i++), fontNormal, false);
            addCellToTable(table, tenSP, fontNormal, false);
            addCellToTable(table, dvt, fontNormal, false);
            addCellToTable(table, loHan, fontNormal, false);
            addCellToTable(table, String.valueOf(ct.getSoLuong()), fontNormal, false);
        }
        document.add(table);

        // 6. Chữ ký (Cần 3 bên: Lập, Kho Xuất, Kho Nhập)
        document.add(new Paragraph("\n", fontNormal));
        PdfPTable signTable = new PdfPTable(2);
        signTable.setWidthPercentage(100);

        addCellSign(signTable, "Người Lập Phiếu", fontBold);
        addCellSign(signTable, "Người Duyệt Phiếu", fontBold);

        addCellSign(signTable, "(Ký tên, Họ tên)", fontNormal);
        addCellSign(signTable, "(Ký tên, Họ tên)", fontNormal);

        document.add(signTable);
        document.close();
        return out.toByteArray();
    }

    // --- Helper Functions ---
    private void addCellToTable(PdfPTable table, String text, Font font, boolean isHeader) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setPadding(5);
        cell.setHorizontalAlignment(isHeader ? Element.ALIGN_CENTER : Element.ALIGN_LEFT);
        if (isHeader) cell.setBackgroundColor(java.awt.Color.LIGHT_GRAY);
        table.addCell(cell);
    }
    private void addCellSign(PdfPTable table, String text, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBorder(Rectangle.NO_BORDER);
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);
        cell.setPaddingTop(10);
        table.addCell(cell);
    }
}