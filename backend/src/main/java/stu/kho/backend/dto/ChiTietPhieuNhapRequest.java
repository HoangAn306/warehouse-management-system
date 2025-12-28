package stu.kho.backend.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class ChiTietPhieuNhapRequest {
    private Integer maSP;
    private Integer soLuong;
    private BigDecimal donGia;

    private String soLo;
    private LocalDate ngayHetHan;
}