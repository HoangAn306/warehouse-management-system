package stu.kho.backend.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import stu.kho.backend.dto.PhieuDieuChuyenFilterRequest;
import stu.kho.backend.dto.PhieuDieuChuyenRequest;
import stu.kho.backend.entity.PhieuDieuChuyen;
import stu.kho.backend.service.PhieuDieuChuyenService;

import java.util.List;

@RestController
@RequestMapping("/api/dieuchuyen")
@CrossOrigin(origins = "*")
@Slf4j // Kích hoạt ghi log
public class PhieuDieuChuyenController {

    private final PhieuDieuChuyenService phieuDieuChuyenService;

    public PhieuDieuChuyenController(PhieuDieuChuyenService phieuDieuChuyenService) {
        this.phieuDieuChuyenService = phieuDieuChuyenService;
    }

    // =================================================================
    // 1. CREATE (Tạo phiếu - Chờ duyệt)
    // =================================================================
    @PostMapping
    @PreAuthorize("hasAuthority('PERM_TRANSFER_CREATE')")
    public ResponseEntity<PhieuDieuChuyen> create(@RequestBody PhieuDieuChuyenRequest request,
                                                  Authentication authentication) {
        String username = authentication.getName();
        log.info("REST request to CREATE PhieuDieuChuyen by User: {}", username);

        // Service sẽ tự động validate kho và tạo phiếu trạng thái Chờ (1)
        return ResponseEntity.ok(phieuDieuChuyenService.create(request, username));
    }

    // =================================================================
    // 2. APPROVE (Duyệt phiếu - Trừ kho xuất, Cộng kho nhập)
    // =================================================================
    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('PERM_TRANSFER_APPROVE')")
    public ResponseEntity<PhieuDieuChuyen> approve(@PathVariable Integer id,
                                                   Authentication authentication) {
        String username = authentication.getName();
        log.info("REST request to APPROVE PhieuDieuChuyen ID: {}, by User: {}", id, username);

        return ResponseEntity.ok(phieuDieuChuyenService.approve(id, username));
    }

    // =================================================================
    // 3. CANCEL (Hủy phiếu - Hoàn trả hàng nếu đã duyệt)
    // =================================================================
    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('PERM_TRANSFER_CANCEL')")
    public ResponseEntity<PhieuDieuChuyen> cancel(@PathVariable Integer id,
                                                  Authentication authentication) {
        String username = authentication.getName();
        log.info("REST request to CANCEL PhieuDieuChuyen ID: {}, by User: {}", id, username);

        return ResponseEntity.ok(phieuDieuChuyenService.cancel(id, username));
    }

    // =================================================================
    // 4. READ (Lấy danh sách)
    // =================================================================
    @GetMapping
    @PreAuthorize("hasAuthority('PERM_TRANSFER_VIEW')")
    public ResponseEntity<List<PhieuDieuChuyen>> getAll() {
        return ResponseEntity.ok(phieuDieuChuyenService.getAll());
    }

    // =================================================================
    // 5. READ (Lấy chi tiết 1 phiếu + Danh sách SP bên trong)
    // =================================================================
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_TRANSFER_VIEW')")
    public ResponseEntity<PhieuDieuChuyen> getById(@PathVariable Integer id) {
        return ResponseEntity.ok(phieuDieuChuyenService.getById(id));
    }

    // =================================================================
    // 6. UPDATE (Sửa phiếu - Cập nhật thông tin & SP)
    // =================================================================
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_TRANSFER_EDIT')")
    public ResponseEntity<PhieuDieuChuyen> update(@PathVariable Integer id,
                                                  @RequestBody PhieuDieuChuyenRequest request,
                                                  Authentication authentication) {
        String username = authentication.getName();
        log.info("REST request to UPDATE PhieuDieuChuyen ID: {}, by User: {}", id, username);

        // Logic Service đã bao gồm Rollback & Re-apply nếu phiếu đã duyệt
        return ResponseEntity.ok(phieuDieuChuyenService.update(id, request, username));
    }

    // =================================================================
    // 7. DELETE (Xóa phiếu)
    // =================================================================
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_TRANSFER_DELETE')")
    public ResponseEntity<String> delete(@PathVariable Integer id,
                                         Authentication authentication) {
        String username = authentication.getName();
        log.info("REST request to DELETE PhieuDieuChuyen ID: {}, by User: {}", id, username);

        phieuDieuChuyenService.delete(id, username);
        return ResponseEntity.ok("Đã xóa thành công Phiếu Điều Chuyển #" + id);
    }

    // =================================================================
    // 8. FILTER (Tìm kiếm nâng cao)
    // =================================================================
    @PostMapping("/filter")
    @PreAuthorize("hasAuthority('PERM_TRANSFER_VIEW')")
    public ResponseEntity<List<PhieuDieuChuyen>> filter(@RequestBody PhieuDieuChuyenFilterRequest request) {
        log.info("REST request to FILTER PhieuDieuChuyen");
        return ResponseEntity.ok(phieuDieuChuyenService.filter(request));
    }
    @GetMapping("/{id}/print")
    public ResponseEntity<byte[]> printPhieuDieuChuyen(@PathVariable Integer id) {
        try {
            byte[] pdfBytes = phieuDieuChuyenService.exportPhieuDieuChuyenPdf(id);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=phieu_dieu_chuyen_" + id + ".pdf")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(pdfBytes);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
}