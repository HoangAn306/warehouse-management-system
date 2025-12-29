package stu.kho.backend.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import stu.kho.backend.entity.ChiTietDieuChuyen;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

@Repository
public class JdbcChiTietDieuChuyenRepository implements ChiTietDieuChuyenRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcChiTietDieuChuyenRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public int save(ChiTietDieuChuyen ct) {
        // [CẬP NHẬT] Thêm SoLo và NgayHetHan vào câu lệnh INSERT
        String sql = "INSERT INTO chitietdieuchuyen (MaPhieuDC, MaSP, SoLuong, SoLo, NgayHetHan) VALUES (?, ?, ?, ?, ?)";

        return jdbcTemplate.update(sql,
                ct.getMaPhieuDC(),
                ct.getMaSP(),
                ct.getSoLuong(),
                // Nếu SoLo null thì lưu PENDING để khớp logic DB
                (ct.getSoLo() == null || ct.getSoLo().isEmpty()) ? "PENDING" : ct.getSoLo(),
                ct.getNgayHetHan()
        );
    }

    @Override
    public List<ChiTietDieuChuyen> findByMaPhieuDC(Integer maPhieuDC) {
        String sql = "SELECT * FROM chitietdieuchuyen WHERE MaPhieuDC = ?";
        return jdbcTemplate.query(sql, new ChiTietRowMapper(), maPhieuDC);
    }

    @Override
    public void deleteByMaPhieuDC(Integer maPhieuDC) {
        String sql = "DELETE FROM chitietdieuchuyen WHERE MaPhieuDC = ?";
        jdbcTemplate.update(sql, maPhieuDC);
    }

    // [CẬP NHẬT] Mapper cũng cần lấy thêm cột SoLo và NgayHetHan ra
    private static class ChiTietRowMapper implements RowMapper<ChiTietDieuChuyen> {
        @Override
        public ChiTietDieuChuyen mapRow(ResultSet rs, int rowNum) throws SQLException {
            ChiTietDieuChuyen ct = new ChiTietDieuChuyen();
            ct.setMaPhieuDC(rs.getInt("MaPhieuDC"));
            ct.setMaSP(rs.getInt("MaSP"));
            ct.setSoLuong(rs.getInt("SoLuong"));

            // Map thêm 2 trường mới
            ct.setSoLo(rs.getString("SoLo"));
            if (rs.getDate("NgayHetHan") != null) {
                ct.setNgayHetHan(rs.getDate("NgayHetHan").toLocalDate());
            }

            return ct;
        }
    }
}