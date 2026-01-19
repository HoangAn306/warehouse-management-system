package stu.kho.backend.repository;

import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import stu.kho.backend.dto.BaoCaoTonKhoDTO;
import stu.kho.backend.dto.LichSuGiaoDichDTO;

@Repository
public class JdbcBaoCaoRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcBaoCaoRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<BaoCaoTonKhoDTO> getBaoCaoTonKho() {
    String sql = "SELECT sp.MaSP, sp.TenSP, sp.DonViTinh, kh.TenKho, " +
                 "ctk.SoLo, ctk.NgayHetHan, ctk.SoLuongTon, " +  // Tồn của lô
                 "sp.SoLuongTon AS TongTon, " +                  // <--- LẤY THÊM TỔNG TỒN (quan trọng)
                 "sp.MucTonToiThieu, sp.MucTonToiDa " +
                 "FROM chitietkho ctk " +
                 "JOIN sanpham sp ON ctk.MaSP = sp.MaSP " +
                 "JOIN khohang kh ON ctk.MaKho = kh.MaKho " +
                 "ORDER BY kh.TenKho, sp.TenSP, ctk.NgayHetHan ASC";

    return jdbcTemplate.query(sql, (rs, rowNum) -> {
        BaoCaoTonKhoDTO dto = new BaoCaoTonKhoDTO();
        // ... (các setter cơ bản giữ nguyên)
        dto.setMaSP(rs.getInt("MaSP"));
        dto.setTenSP(rs.getString("TenSP"));
        dto.setDonViTinh(rs.getString("DonViTinh"));
        dto.setTenKho(rs.getString("TenKho"));
        dto.setSoLo(rs.getString("SoLo"));
        dto.setNgayHetHan(rs.getDate("NgayHetHan"));
        
        // Map số lượng
        dto.setSoLuongTon(rs.getInt("SoLuongTon")); // Vẫn set tồn của lô để hiển thị UI
        
        // Lấy các chỉ số để tính toán
        int tongTon = rs.getInt("TongTon"); // <--- Lấy tổng tồn từ DB
        int min = rs.getInt("MucTonToiThieu");
        int max = rs.getInt("MucTonToiDa");

        dto.setMucTonToiThieu(min);
        dto.setMucTonToiDa(max);

        // --- LOGIC CẢNH BÁO MỚI (ĐÚNG) ---
        // So sánh 'TỔNG TỒN' với định mức, thay vì dùng 'Tồn của lô'
        if (tongTon <= min) {
            dto.setTrangThaiCanhBao("WARNING_LOW"); // Tổng kho thấp -> Báo động
        } else if (max > 0 && tongTon >= max) {
            dto.setTrangThaiCanhBao("WARNING_HIGH"); // Tổng kho quá nhiều -> Báo động
        } else {
            dto.setTrangThaiCanhBao("NORMAL");
        }


        return dto;
    });
}
    public List<LichSuGiaoDichDTO> getLichSuGiaoDich() {

        // SQL cho PHIẾU NHẬP
        String sqlNhap =
                "SELECT " +
                        "  CONCAT('PN-', p.MaPhieuNhap, '-', ct.MaSP) as MaGiaoDich, " +
                        "  p.NgayLapPhieu as Ngay, " +
                        "  'NHAP' as LoaiGiaoDich, " +
                        "  p.ChungTu, " +
                        "  sp.TenSP, " +
                        "  k.TenKho, " +
                        "  ct.SoLuong " +
                        "FROM phieunhaphang p " +
                        "JOIN chitietphieunhap ct ON p.MaPhieuNhap = ct.MaPhieuNhap " +
                        "JOIN sanpham sp ON ct.MaSP = sp.MaSP " +
                        "JOIN khohang k ON p.MaKho = k.MaKho " +
                        "WHERE p.TrangThai = 2 "; // Chỉ lấy phiếu ĐÃ DUYỆT (tùy chọn)

        // SQL cho PHIẾU XUẤT
        String sqlXuat =
                "SELECT " +
                        "  CONCAT('PX-', p.MaPhieuXuat, '-', ct.MaSP) as MaGiaoDich, " +
                        "  p.NgayLapPhieu as Ngay, " +
                        "  'XUAT' as LoaiGiaoDich, " +
                        "  p.ChungTu, " +
                        "  sp.TenSP, " +
                        "  k.TenKho, " +
                        "  ct.SoLuong " +
                        "FROM phieuxuathang p " +
                        "JOIN chitietphieuxuat ct ON p.MaPhieuXuat = ct.MaPhieuXuat " +
                        "JOIN sanpham sp ON ct.MaSP = sp.MaSP " +
                        "JOIN khohang k ON p.MaKho = k.MaKho " +
                        "WHERE p.TrangThai = 2 "; // Chỉ lấy phiếu ĐÃ DUYỆT (tùy chọn)

        // GỘP 2 SQL VÀ SẮP XẾP
        String finalSql = sqlNhap + " UNION ALL " + sqlXuat + " ORDER BY Ngay DESC";

        return jdbcTemplate.query(finalSql, (rs, rowNum) -> {
            LichSuGiaoDichDTO dto = new LichSuGiaoDichDTO();
            dto.setMaGiaoDich(rs.getString("MaGiaoDich"));
            if (rs.getTimestamp("Ngay") != null) {
                dto.setNgay(rs.getTimestamp("Ngay").toLocalDateTime());
            }
            dto.setLoaiGiaoDich(rs.getString("LoaiGiaoDich"));
            dto.setChungTu(rs.getString("ChungTu"));
            dto.setTenSP(rs.getString("TenSP"));
            dto.setTenKho(rs.getString("TenKho"));
            dto.setSoLuong(rs.getInt("SoLuong"));
            return dto;
        });
    }
}