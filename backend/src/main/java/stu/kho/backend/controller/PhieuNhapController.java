package stu.kho.backend.controller;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import stu.kho.backend.dto.PhieuNhapFilterRequest;
import stu.kho.backend.dto.PhieuNhapRequest;
import stu.kho.backend.entity.PhieuNhapHang;
import stu.kho.backend.service.PhieuNhapService;

import java.util.List;

@RestController
@RequestMapping("/api/phieunhap")
@CrossOrigin(origins = "*")
public class PhieuNhapController {

    private final PhieuNhapService phieuNhapService;

    public PhieuNhapController(PhieuNhapService phieuNhapService) {
        this.phieuNhapService = phieuNhapService;
    }

    // =================================================================
    // 1. CREATE (Tạo phiếu - Chờ duyệt)
    // =================================================================
    @PostMapping
    @PreAuthorize("hasAuthority('PERM_PHIEUNHAP_CREATE')") // Quyền: Thủ kho, Admin
    public ResponseEntity<?> createPhieuNhap(@RequestBody PhieuNhapRequest request,
                                             Authentication authentication) {
        try {
            String tenNguoiLap = authentication.getName();
            // Service sẽ tự động set trạng thái là 1 (Chờ duyệt)
            PhieuNhapHang phieuNhapMoi = phieuNhapService.createPhieuNhap(request, tenNguoiLap);
            return ResponseEntity.ok(phieuNhapMoi);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // =================================================================
    // 2. APPROVE (Duyệt phiếu - API MỚI)
    // =================================================================
    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('PERM_PHIEUNHAP_APPROVE')") // Quyền: Quản lý, Admin
    public ResponseEntity<?> approvePhieuNhap(@PathVariable Integer id,
                                              Authentication authentication) {
        try {
            String tenNguoiDuyet = authentication.getName();
            PhieuNhapHang phieuNhap = phieuNhapService.approvePhieuNhap(id, tenNguoiDuyet);
            return ResponseEntity.ok(phieuNhap);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // =================================================================
    // 3. CANCEL (Hủy phiếu - API MỚI)
    // =================================================================
    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('PERM_PHIEUNHAP_CANCEL')") // Quyền: Quản lý, Admin
    public ResponseEntity<?> cancelPhieuNhap(@PathVariable Integer id,
                                             Authentication authentication) {
        try {
            String tenNguoiHuy = authentication.getName();
            PhieuNhapHang phieuNhap = phieuNhapService.cancelPhieuNhap(id, tenNguoiHuy);
            return ResponseEntity.ok(phieuNhap);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // =================================================================
    // 4. READ (Lấy danh sách)
    // =================================================================
    @GetMapping
    @PreAuthorize("isAuthenticated()") // Ai cũng có thể xem danh sách (nếu đã đăng nhập)
    public ResponseEntity<List<PhieuNhapHang>> getAllPhieuNhap() {
        return ResponseEntity.ok(phieuNhapService.getAllPhieuNhap());
    }

    // =================================================================
    // 5. READ (Lấy chi tiết 1 phiếu)
    // =================================================================
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PhieuNhapHang> getPhieuNhapById(@PathVariable Integer id) {
        try {
            return ResponseEntity.ok(phieuNhapService.getPhieuNhapById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // =================================================================
    // 6. UPDATE (Sửa phiếu)
    // =================================================================
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_PHIEUNHAP_EDIT')") // Quyền: Thủ kho, Admin
    public ResponseEntity<?> updatePhieuNhap(@PathVariable Integer id,
                                             @RequestBody PhieuNhapRequest request,
                                             Authentication authentication) {
        try {
            String tenNguoiSua = authentication.getName();
            PhieuNhapHang phieuNhapUpdated = phieuNhapService.updatePhieuNhap(id, request, tenNguoiSua);
            return ResponseEntity.ok(phieuNhapUpdated);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // =================================================================
    // 7. DELETE (Xóa phiếu)
    // =================================================================
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_PHIEUNHAP_DELETE')") // Quyền: Admin
    public ResponseEntity<?> deletePhieuNhap(@PathVariable Integer id,
                                             Authentication authentication) {
        try {
            String tenNguoiXoa = authentication.getName();
            phieuNhapService.deletePhieuNhap(id, tenNguoiXoa);
            return ResponseEntity.ok("Đã xóa thành công Phiếu Nhập #" + id);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
    @PostMapping("/filter")
    @PreAuthorize("isAuthenticated()") // Hoặc quyền VIEW
    public ResponseEntity<List<PhieuNhapHang>> filter(@RequestBody PhieuNhapFilterRequest request) {
        // (Giả sử bạn đã thêm hàm filter vào Service gọi Repo)
        return ResponseEntity.ok(phieuNhapService.filterPhieuNhap(request));
    }
    @GetMapping("/{id}/print")
    public ResponseEntity<byte[]> printPhieuNhap(@PathVariable Integer id) {
        try {
            byte[] pdfBytes = phieuNhapService.exportPhieuNhapPdf(id);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=phieu_nhap_" + id + ".pdf")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(pdfBytes);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
}