package stu.kho.backend.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class JdbcNccSanPhamRepository implements NccSanPhamRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcNccSanPhamRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public int linkNccToSanPham(Integer maNCC, Integer maSP) {
        String sql = "INSERT INTO ncc_sanpham (MaNCC, MaSP) VALUES (?, ?)";
        return jdbcTemplate.update(sql, maNCC, maSP);
    }

    @Override
    public int unlinkNccFromSanPham(Integer maNCC, Integer maSP) {
        String sql = "DELETE FROM ncc_sanpham WHERE MaNCC = ? AND MaSP = ?";
        return jdbcTemplate.update(sql, maNCC, maSP);
    }

    @Override
    public List<Integer> findNccIdsByMaSP(Integer maSP) {
        String sql = "SELECT MaNCC FROM ncc_sanpham WHERE MaSP = ?";
        return jdbcTemplate.queryForList(sql, Integer.class, maSP);
    }
    @Override
    public boolean existsLink(Integer maNCC, Integer maSP) {
        String sql = "SELECT COUNT(*) FROM ncc_sanpham WHERE MaNCC = ? AND MaSP = ?";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, maNCC, maSP);
        return count != null && count > 0;
    }
    @Override
    public List<Integer> findMaNCCByMaSP(Integer maSP) {
        String sql = "SELECT MaNCC FROM ncc_sanpham WHERE MaSP = ?";
        return jdbcTemplate.queryForList(sql, Integer.class, maSP);
    }
}