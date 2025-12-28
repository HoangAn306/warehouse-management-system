package stu.kho.backend.dto;

import lombok.Data;
import java.util.List;

@Data
public class PhieuXuatRequest {
    private Integer trangThai; // Thường mặc định là 1
    private Integer maKH;
    private Integer maKho;
    private Integer nguoiDuyet;
    private String chungTu;
    private String soLo;

    private List<ChiTietPhieuXuatRequest> chiTiet;
}