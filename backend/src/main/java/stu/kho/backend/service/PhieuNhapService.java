package stu.kho.backend.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

import org.springframework.security.core.context.SecurityContextHolder;
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

import stu.kho.backend.dto.ChiTietPhieuNhapRequest;
import stu.kho.backend.dto.PhieuNhapFilterRequest;
import stu.kho.backend.dto.PhieuNhapRequest;
import stu.kho.backend.entity.ChiTietKho;
import stu.kho.backend.entity.ChiTietPhieuNhap;
import stu.kho.backend.entity.HoatDong;
import stu.kho.backend.entity.KhoHang;
import stu.kho.backend.entity.NguoiDung;
import stu.kho.backend.entity.NhaCungCap;
import stu.kho.backend.entity.PhieuNhapHang;
import stu.kho.backend.entity.SanPham;
import stu.kho.backend.repository.ChiTietKhoRepository;
import stu.kho.backend.repository.ChiTietPhieuNhapRepository;
import stu.kho.backend.repository.HoatDongRepository;
import stu.kho.backend.repository.KhoHangRepository;
import stu.kho.backend.repository.NccSanPhamRepository;
import stu.kho.backend.repository.NguoiDungRepository;
import stu.kho.backend.repository.NhaCungCapRepository;
import stu.kho.backend.repository.PhieuNhapRepository;
import stu.kho.backend.repository.SanPhamRepository;

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
    private final NhaCungCapRepository nhaCungCapRepository; // [MỚI] Để lấy tên NCC
    private final KhoHangRepository khoHangRepository;

    public PhieuNhapService(PhieuNhapRepository phieuNhapRepository,
                            ChiTietPhieuNhapRepository chiTietPhieuNhapRepository,
                            ChiTietKhoRepository chiTietKhoRepository,
                            HoatDongRepository hoatDongRepository,
                            NguoiDungRepository nguoiDungRepository,
                            SanPhamRepository sanPhamRepository,
                            NccSanPhamRepository nccSanPhamRepository, NhaCungCapRepository nhaCungCapRepository, KhoHangRepository khoHangRepository) {
        this.phieuNhapRepository = phieuNhapRepository;
        this.chiTietPhieuNhapRepository = chiTietPhieuNhapRepository;
        this.chiTietKhoRepository = chiTietKhoRepository;
        this.hoatDongRepository = hoatDongRepository;
        this.nguoiDungRepository = nguoiDungRepository;
        this.sanPhamRepository = sanPhamRepository;
        this.nccSanPhamRepository = nccSanPhamRepository;
        this.nhaCungCapRepository = nhaCungCapRepository;
        this.khoHangRepository = khoHangRepository;
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

    // =================================================================
    // TÍNH NĂNG IN PHIẾU NHẬP (PDF)
    // =================================================================
    public byte[] exportPhieuNhapPdf(Integer id) throws DocumentException, IOException {
        // 1. Lấy dữ liệu
        PhieuNhapHang pn = getPhieuNhapById(id);
        NhaCungCap ncc = nhaCungCapRepository.findById(pn.getMaNCC()).orElse(new NhaCungCap());
        KhoHang kho = khoHangRepository.findById(pn.getMaKho()).orElse(new KhoHang());
        List<ChiTietPhieuNhap> chiTietList = pn.getChiTiet();

        // 2. Khởi tạo PDF
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4);
        PdfWriter.getInstance(document, out);
        document.open();

        BaseFont bf = BaseFont.createFont("fonts/times.ttf", BaseFont.IDENTITY_H, BaseFont.EMBEDDED); // Nếu có file font

        Font fontTitle = new Font(bf, 18, Font.BOLD);
        Font fontBold = new Font(bf, 11, Font.BOLD);
        Font fontNormal = new Font(bf, 11, Font.NORMAL);

        // 3. Tiêu đề
        Paragraph title = new Paragraph("PHIẾU NHẬP KHO", fontTitle);
        title.setAlignment(Element.ALIGN_CENTER);
        document.add(title);
        document.add(new Paragraph(" ", fontNormal));

        // 4. Thông tin chung (NCC và Kho)
        PdfPTable infoTable = new PdfPTable(2);
        infoTable.setWidthPercentage(100);

        addTextToTable(infoTable, "Mã Phiếu: #" + pn.getMaPhieuNhap(), fontBold);
        addTextToTable(infoTable, "Ngày Lập Phiếu: " + pn.getNgayLapPhieu().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")), fontNormal);

        addTextToTable(infoTable, "Nhà Cung Cấp: " + ncc.getTenNCC(), fontNormal);
        addTextToTable(infoTable, "SDT: " + (ncc.getSdt() != null ? ncc.getSdt() : ""), fontNormal);

        addTextToTable(infoTable, "Nhập vào Kho: " + kho.getTenKho(), fontNormal);
        addTextToTable(infoTable, "Địa Chỉ: " + (kho.getDiaChi() != null ? kho.getDiaChi() : ""), fontNormal);

        document.add(infoTable);
        document.add(new Paragraph(" ", fontNormal));

        // 5. Bảng chi tiết (Thêm cột Hạn Sử Dụng)
        // Cột: STT, Tên SP, ĐVT, Lô/Hạn, SL, Đơn Giá, Thành Tiền
        PdfPTable table = new PdfPTable(7);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{0.8f, 3.5f, 1.2f, 2.5f, 1.2f, 2f, 2.5f});

        addCellToTable(table, "STT", fontBold, true);
        addCellToTable(table, "Tên Hàng", fontBold, true);
        addCellToTable(table, "Đơn vị tính", fontBold, true);
        addCellToTable(table, "Lô /HSD", fontBold, true); // Quan trọng với phiếu nhập
        addCellToTable(table, "Số lượng", fontBold, true);
        addCellToTable(table, "Đơn Giá", fontBold, true);
        addCellToTable(table, "Thành Tiền", fontBold, true);

        int i = 1;
        DateTimeFormatter dateFmt = DateTimeFormatter.ofPattern("dd/MM/yy");

        for (ChiTietPhieuNhap ct : chiTietList) {
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
            addCellToTable(table, formatMoney(ct.getDonGia()), fontNormal, false);
            addCellToTable(table, formatMoney(ct.getThanhTien()), fontNormal, false);
        }
        document.add(table);

        // 6. Tổng tiền
        Paragraph totalPara = new Paragraph("Tổng Công: " + formatMoney(pn.getTongTien()), fontBold);
        totalPara.setAlignment(Element.ALIGN_RIGHT);
        totalPara.setSpacingBefore(10);
        document.add(totalPara);

        // 7. Chữ ký
        document.add(new Paragraph("\n", fontNormal));
        PdfPTable signTable = new PdfPTable(3);
        signTable.setWidthPercentage(100);

        addCellSign(signTable, "Người Lập Phiếu", fontBold);
        addCellSign(signTable, "Người duyệt phiếu", fontBold);
        addCellSign(signTable, "Nhà Cung Cấp", fontBold);

        addCellSign(signTable, "(Ký tên, Họ tên)", fontNormal);
        addCellSign(signTable, "(Ký tên, Họ tên)", fontNormal);
        addCellSign(signTable, "(Ký tên, Họ tên)", fontNormal);

        document.add(signTable);
        document.close();
        return out.toByteArray();
    }

    // --- Các hàm Helper (Copy y hệt bên Phiếu Xuất) ---
    private void addTextToTable(PdfPTable table, String text, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBorder(Rectangle.NO_BORDER);
        cell.setPadding(3);
        table.addCell(cell);
    }
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
    private String formatMoney(java.math.BigDecimal money) {
        if (money == null) return "0";
        return String.format("%,.0f", money);
    }

    private void logActivity(Integer maNguoiDung, String hanhDong) {
        HoatDong log = new HoatDong();
        log.setMaNguoiDung(maNguoiDung);
        log.setHanhDong(hanhDong);
        log.setThoiGianThucHien(LocalDateTime.now());
        hoatDongRepository.save(log);
    }
}