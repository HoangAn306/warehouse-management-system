package stu.kho.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class ChiTietPhieuXuat {

    // 1. Ẩn ID cha bị lặp lại
    @JsonIgnore
    private Integer maPhieuXuat;

    private Integer maSP;
    private Integer soLuong;
    private BigDecimal donGia;
    private BigDecimal thanhTien;

    // 2. & 3. Ẩn các trường không cần thiết của Sản phẩm trong bối cảnh Xuất hàng
    @JsonIgnoreProperties({
            "danhSachNCC",      // Xuất hàng không cần biết NCC
            "giaNhap",          // Không lộ giá vốn
            "mucTonToiThieu",   // Không cần thiết
            "mucTonToiDa",      // Không cần thiết
            "loaiHang",         // (Tùy chọn) Có thể ẩn nếu chỉ cần tên SP
            "maLoai"
    })
    private String soLo;
    private SanPham sanPham;
}