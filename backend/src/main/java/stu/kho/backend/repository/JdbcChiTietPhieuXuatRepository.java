package stu.kho.backend.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import stu.kho.backend.entity.ChiTietPhieuXuat;
import java.util.List;

@Repository
public class JdbcChiTietPhieuXuatRepository implements ChiTietPhieuXuatRepository {

    private final JdbcTemplate jdbcTemplate;
    private final SanPhamRepository sanPhamRepository;

    private final RowMapper<ChiTietPhieuXuat> rowMapper;

    public JdbcChiTietPhieuXuatRepository(JdbcTemplate jdbcTemplate, SanPhamRepository sanPhamRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.sanPhamRepository = sanPhamRepository;

        this.rowMapper = (rs, rowNum) -> {
            ChiTietPhieuXuat ct = new ChiTietPhieuXuat();
            ct.setMaPhieuXuat(rs.getInt("MaPhieuXuat"));
            ct.setMaSP(rs.getInt("MaSP"));
            ct.setSoLuong(rs.getInt("SoLuong"));
            ct.setDonGia(rs.getBigDecimal("DonGia"));
            ct.setThanhTien(rs.getBigDecimal("ThanhTien"));

            ct.setSanPham(sanPhamRepository.findById(ct.getMaSP()).orElse(null));
            return ct;
        };
    }

    @Override
    public int save(ChiTietPhieuXuat ct) {
        String sql = "INSERT INTO chitietphieuxuat (MaPhieuXuat, MaSP, SoLuong, DonGia, ThanhTien,SoLo) VALUES (?, ?, ?, ?, ?,?)";
        return jdbcTemplate.update(sql, ct.getMaPhieuXuat(), ct.getMaSP(), ct.getSoLuong(), ct.getDonGia(), ct.getThanhTien(),ct.getSoLo());
    }

    @Override
    public List<ChiTietPhieuXuat> findByMaPhieuXuat(Integer maPhieuXuat) {
        String sql = "SELECT * FROM chitietphieuxuat WHERE MaPhieuXuat = ?";
        return jdbcTemplate.query(sql, rowMapper, maPhieuXuat);
    }

    @Override
    public int deleteByMaPhieuXuat(Integer maPhieuXuat) {
        String sql = "DELETE FROM chitietphieuxuat WHERE MaPhieuXuat = ?";
        return jdbcTemplate.update(sql, maPhieuXuat);
    }
}