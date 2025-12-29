package stu.kho.backend.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class SanPhamTrongKhoResponse {
    private Integer maSP;
    private String tenSP;
    private String donViTinh;
    private String hinhAnh;
    private BigDecimal giaNhap;
    private Integer soLuongTon;
    private String soLo;        // <--- Mới
    private LocalDate ngayHetHan;// Số lượng tại kho cụ thể này
}