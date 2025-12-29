package stu.kho.backend.dto;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class BaoCaoNxtDTO {
    private Integer maSP;
    private String tenSP;
    private String donViTinh;
    private String soLo;
    private LocalDate ngayHetHan;
    private Integer tonDau;
    private Integer slNhap;
    private Integer slXuat;
    private Integer tonCuoi;
    private BigDecimal giaTriTonCuoi; // Tạm tính theo giá nhập hiện tại
}