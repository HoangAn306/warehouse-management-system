package stu.kho.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;

import java.time.LocalDate;

@Data
public class ChiTietDieuChuyen {
    @JsonIgnore
    private Integer maPhieuDC;
    private Integer maSP;
    private Integer soLuong;

    private String soLo;
    private LocalDate ngayHetHan;
    private SanPham sanPham;
}