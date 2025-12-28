package stu.kho.backend.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import stu.kho.backend.entity.ChiTietPhieuNhap;

import java.util.List;

@Repository
public class JdbcChiTietPhieuNhapRepository implements ChiTietPhieuNhapRepository {

    private final JdbcTemplate jdbcTemplate;
    private final SanPhamRepository sanPhamRepository; // Cần để JOIN

    private final RowMapper<ChiTietPhieuNhap> chiTietRowMapper;

    public JdbcChiTietPhieuNhapRepository(JdbcTemplate jdbcTemplate, SanPhamRepository sanPhamRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.sanPhamRepository = sanPhamRepository;

        // Khởi tạo RowMapper
        this.chiTietRowMapper = (rs, rowNum) -> {
            ChiTietPhieuNhap ct = new ChiTietPhieuNhap();
            ct.setMaPhieuNhap(rs.getInt("MaPhieuNhap"));
            ct.setMaSP(rs.getInt("MaSP"));
            ct.setSoLuong(rs.getInt("SoLuong"));
            ct.setDonGia(rs.getBigDecimal("DonGia"));
            ct.setThanhTien(rs.getBigDecimal("ThanhTien"));
            ct.setSoLo(rs.getString("SoLo"));
            java.sql.Date sqlDate = rs.getDate("NgayHetHan");
            if (sqlDate != null) {
                ct.setNgayHetHan(sqlDate.toLocalDate());
            }
            // --- JOIN Dữ liệu ---
            if (ct.getMaSP() != null) {
                ct.setSanPham(sanPhamRepository.findById(ct.getMaSP()).orElse(null));
            }
            return ct;
        };
    }

    @Override
    public int save(ChiTietPhieuNhap chiTiet) {
        // Bảng này dùng Khóa Chính Tổng Hợp, không có ID tự động tăng
        String sql = "INSERT INTO chitietphieunhap (MaPhieuNhap, MaSP, SoLuong, DonGia, ThanhTien) " +
                "VALUES (?, ?, ?, ?, ?)";
        return jdbcTemplate.update(sql,
                chiTiet.getMaPhieuNhap(),
                chiTiet.getMaSP(),
                chiTiet.getSoLuong(),
                chiTiet.getDonGia(),
                chiTiet.getThanhTien()
        );
    }

    @Override
    public List<ChiTietPhieuNhap> findByMaPhieuNhap(Integer maPhieuNhap) {
        String sql = "SELECT * FROM chitietphieunhap WHERE MaPhieuNhap = ?";
        return jdbcTemplate.query(sql, chiTietRowMapper, maPhieuNhap);
    }

    @Override
    public int deleteByMaPhieuNhap(Integer maPhieuNhap) {
        String sql = "DELETE FROM chitietphieunhap WHERE MaPhieuNhap = ?";
        return jdbcTemplate.update(sql, maPhieuNhap);
    }
}