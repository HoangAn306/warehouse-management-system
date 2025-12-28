package stu.kho.backend.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class ChiTietPhieuXuatRequest {
    private Integer maSP;
    private Integer soLuong;
    private BigDecimal donGia;
    private String soLo;

}