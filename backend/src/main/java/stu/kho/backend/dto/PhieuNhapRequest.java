package stu.kho.backend.dto;

import lombok.Data;
import java.util.List;

@Data
public class PhieuNhapRequest {
    // Thông tin phiếu chính
    private Integer trangThai;
    private Integer maNCC;
    private Integer maKho;
    // NguoiLap sẽ được lấy từ JWT (Authentication)
    private Integer nguoiDuyet;
    private String chungTu;

    // Danh sách các sản phẩm chi tiết
    private List<ChiTietPhieuNhapRequest> chiTiet;
}