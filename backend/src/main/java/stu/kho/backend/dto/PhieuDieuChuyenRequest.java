package stu.kho.backend.dto;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class PhieuDieuChuyenRequest {
    private Integer maKhoXuat;
    private Integer maKhoNhap;
    private String ghiChu;
    private String chungTu;
    private LocalDateTime ngayChuyen;
    private List<ChiTietDieuChuyenRequest> chiTiet;

    @Data
    public static class ChiTietDieuChuyenRequest {
        private Integer maSP;
        private Integer soLuong;
        private String soLo;
        private LocalDate ngayHetHan;
    }
}