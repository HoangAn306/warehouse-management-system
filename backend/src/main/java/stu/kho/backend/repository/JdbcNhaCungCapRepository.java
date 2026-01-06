package stu.kho.backend.repository;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
import java.util.Optional;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import stu.kho.backend.entity.NhaCungCap;

@Repository
public class JdbcNhaCungCapRepository implements NhaCungCapRepository {

    private final JdbcTemplate jdbcTemplate;

    // RowMapper để ánh xạ dữ liệu từ CSDL sang Entity
    private final RowMapper<NhaCungCap> nccRowMapper = (rs, rowNum) -> {
        NhaCungCap ncc = new NhaCungCap();
        ncc.setMaNCC(rs.getInt("MaNCC"));
        ncc.setTenNCC(rs.getString("TenNCC"));
        ncc.setNguoiLienHe(rs.getString("NguoiLienHe"));
        ncc.setSdt(rs.getString("SDT"));
        ncc.setDiaChi(rs.getString("DiaChi"));
        ncc.setEmail(rs.getString("Email"));
        ncc.setDaXoa(rs.getBoolean("DaXoa"));
        return ncc;
    };

    public JdbcNhaCungCapRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Optional<NhaCungCap> findById(Integer id) {
        String sql = "SELECT * FROM nhacungcap WHERE MaNCC = ? AND DaXoa = 0";
        try {
            NhaCungCap ncc = jdbcTemplate.queryForObject(sql, nccRowMapper, id);
            return Optional.ofNullable(ncc);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public List<NhaCungCap> findAll() {
        String sql = "SELECT * FROM nhacungcap WHERE DaXoa = 0";
        return jdbcTemplate.query(sql, nccRowMapper);
    }

    // --- PHƯƠNG THỨC BỔ SUNG: SAVE (Trả về ID) ---
    @Override
    public int save(NhaCungCap ncc) {
        String sql = "INSERT INTO nhacungcap (TenNCC, NguoiLienHe, SDT, DiaChi, Email) VALUES (?, ?, ?, ?, ?)";

        KeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, ncc.getTenNCC());
            ps.setString(2, ncc.getNguoiLienHe());
            ps.setString(3, ncc.getSdt());
            ps.setString(4, ncc.getDiaChi());
            ps.setString(5, ncc.getEmail());
            return ps;
        }, keyHolder);

        // Trả về MaNCC vừa được tạo
        if (keyHolder.getKey() != null) {
            return keyHolder.getKey().intValue();
        } else {
            return -1; // Hoặc ném ngoại lệ nếu cần
        }
    }

    // --- PHƯƠNG THỨC BỔ SUNG: UPDATE ---
    @Override
    public int update(NhaCungCap ncc) {
        String sql = "UPDATE nhacungcap SET TenNCC = ?, NguoiLienHe = ?, SDT = ?, DiaChi = ?, Email = ? WHERE MaNCC = ?";
        return jdbcTemplate.update(sql,
                ncc.getTenNCC(),
                ncc.getNguoiLienHe(),
                ncc.getSdt(),
                ncc.getDiaChi(),
                ncc.getEmail(),
                ncc.getMaNCC()
        );
    }

    // --- PHƯƠNG THỨC BỔ SUNG: DELETE ---
    @Override
    public int deleteById(Integer id) {
        // Lưu ý: Việc xóa có thể thất bại nếu NCC này đang được tham chiếu ở bảng khác (khóa ngoại)
        String sql = "UPDATE nhacungcap SET DaXoa = 1 WHERE MaNCC = ?";
        return jdbcTemplate.update(sql, id);
    }

    @Override
    public List<NhaCungCap> search(String keyword) {
        // SỬA LẠI: Thêm dấu ngoặc đơn bao quanh các điều kiện OR
        String sql = "SELECT * FROM nhacungcap WHERE (TenNCC LIKE ? OR NguoiLienHe LIKE ? OR SDT LIKE ?) AND DaXoa = 0";

        String searchArg = "%" + keyword + "%";
        return jdbcTemplate.query(sql, nccRowMapper, searchArg, searchArg, searchArg);
    }

    @Override
    public void restoreById(Integer id) {
        // Khôi phục: Set DaXoa về 0
        String sql = "UPDATE nhacungcap SET DaXoa = 0 WHERE MaNCC = ?";
        jdbcTemplate.update(sql, id);
    }

    @Override
    public List<NhaCungCap> findAllDeleted() {
        // Lấy danh sách đã xóa: DaXoa = 1
        String sql = "SELECT * FROM nhacungcap WHERE DaXoa = 1";
        // Tái sử dụng RowMapper bạn đã khai báo
        return jdbcTemplate.query(sql, nccRowMapper);
    }
    @Override
    public List<NhaCungCap> findByTenNCCIncludingDeleted(String tenNCC) {
        // SQL này KHÔNG có điều kiện "AND DaXoa = 0"
        String sql = "SELECT * FROM nhacungcap WHERE TenNCC = ?";
        return jdbcTemplate.query(sql, nccRowMapper, tenNCC);
    }
}