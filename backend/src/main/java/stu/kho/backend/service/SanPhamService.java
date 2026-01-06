package stu.kho.backend.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import stu.kho.backend.dto.SanPhamFilterRequest;
import stu.kho.backend.dto.SanPhamRequest;
import stu.kho.backend.entity.HoatDong;
import stu.kho.backend.entity.SanPham;
import stu.kho.backend.repository.HoatDongRepository;
import stu.kho.backend.repository.LoaiHangRepository;
import stu.kho.backend.repository.NccSanPhamRepository;
import stu.kho.backend.repository.NguoiDungRepository;
import stu.kho.backend.repository.SanPhamRepository;

@Service
public class SanPhamService {

    private final SanPhamRepository sanPhamRepository;
    private final NccSanPhamRepository nccSanPhamRepository;
    private final HoatDongRepository hoatDongRepository;
    private final NguoiDungRepository nguoiDungRepository;
    private final CloudinaryService cloudinaryService;
    private final LoaiHangRepository loaiHangRepository;

    public SanPhamService(SanPhamRepository sanPhamRepository,
                          NccSanPhamRepository nccSanPhamRepository,
                          HoatDongRepository hoatDongRepository,
                          NguoiDungRepository nguoiDungRepository,
                          CloudinaryService cloudinaryService, LoaiHangRepository loaiHangRepository) {
        this.sanPhamRepository = sanPhamRepository;
        this.nccSanPhamRepository = nccSanPhamRepository;
        this.hoatDongRepository = hoatDongRepository;
        this.nguoiDungRepository = nguoiDungRepository;
        this.cloudinaryService = cloudinaryService;
        this.loaiHangRepository = loaiHangRepository;
    }

    // =================================================================
    // 1. CREATE (Thêm mới có ảnh)
    // =================================================================
    @Transactional
    public SanPham createSanPham(SanPhamRequest request, MultipartFile imageFile, String tenNguoiTao) {
        // [CẬP NHẬT] Truyền null vì tạo mới chưa có ID
        validateProductUniqueness(request, null);
        
        // 1. Tạo đối tượng SanPham
        SanPham sp = new SanPham();
        sp.setTenSP(request.getTenSP());
        sp.setDonViTinh(request.getDonViTinh());
        sp.setGiaNhap(request.getGiaNhap());
        sp.setMucTonToiThieu(request.getMucTonToiThieu());
        sp.setMucTonToiDa(request.getMucTonToiDa());
        sp.setMaLoai(request.getMaLoai());
        sp.setSoLuongTon(0); // Mặc định tồn kho là 0

        // --- XỬ LÝ ẢNH ---
        if (imageFile != null && !imageFile.isEmpty()) {
            String imageUrl = cloudinaryService.uploadImage(imageFile);
            sp.setHinhAnh(imageUrl); // Lưu URL ảnh vào DB
        }
        // -----------------

        // 2. Lưu vào bảng 'sanpham' và lấy ID
        int maSP = sanPhamRepository.save(sp);
        sp.setMaSP(maSP);

        // 3. Lưu liên kết N:M với Nhà Cung Cấp
        if (request.getDanhSachMaNCC() != null) {
            for (Integer maNCC : request.getDanhSachMaNCC()) {
                nccSanPhamRepository.linkNccToSanPham(maNCC, maSP);
            }
        }

        // 4. Ghi log
        logActivity(tenNguoiTao, "Thêm sản phẩm mới: " + sp.getTenSP());

        // Trả về đầy đủ thông tin (bao gồm cả list NCC vừa thêm)
        return getSanPhamById(maSP);
    }

    // =================================================================
    // 2. UPDATE (Cập nhật có ảnh)
    // =================================================================
    @Transactional
    public SanPham updateSanPham(Integer id, SanPhamRequest request, MultipartFile imageFile, String tenNguoiSua) {
        // [CẬP NHẬT] Truyền ID hiện tại để loại trừ khi check trùng tên
        validateProductUniqueness(request, id);

        SanPham spCu = sanPhamRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy sản phẩm ID: " + id));

        // 1. Cập nhật thông tin cơ bản
        spCu.setTenSP(request.getTenSP());
        spCu.setDonViTinh(request.getDonViTinh());
        spCu.setGiaNhap(request.getGiaNhap());
        spCu.setMucTonToiThieu(request.getMucTonToiThieu());
        spCu.setMucTonToiDa(request.getMucTonToiDa());
        spCu.setMaLoai(request.getMaLoai());

        // --- XỬ LÝ ẢNH (Chỉ cập nhật nếu có file mới gửi lên) ---
        if (imageFile != null && !imageFile.isEmpty()) {
            String imageUrl = cloudinaryService.uploadImage(imageFile);
            spCu.setHinhAnh(imageUrl);
        }
        // --------------------------------------------------------

        sanPhamRepository.update(spCu);

        // 2. Cập nhật liên kết NCC (Xóa cũ -> Thêm mới)
        List<Integer> oldNccIds = nccSanPhamRepository.findNccIdsByMaSP(id);
        for (Integer oldNccId : oldNccIds) {
            nccSanPhamRepository.unlinkNccFromSanPham(oldNccId, id);
        }

        if (request.getDanhSachMaNCC() != null) {
            for (Integer maNCC : request.getDanhSachMaNCC()) {
                nccSanPhamRepository.linkNccToSanPham(maNCC, id);
            }
        }

        logActivity(tenNguoiSua, "Cập nhật sản phẩm ID: " + id);

        return getSanPhamById(id);
    }

    // =================================================================
    // 3. DELETE
    // =================================================================
    @Transactional
    public void deleteSanPham(Integer id, String tenNguoiXoa) {
        // 1. Kiểm tra tồn tại
        SanPham sp = sanPhamRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Sản phẩm không tồn tại."));

        // --- BỔ SUNG: CHECK TỒN KHO TRƯỚC KHI XÓA ---
        int tongTon = sanPhamRepository.countTotalInventory(id);

        if (tongTon > 0) {
            throw new RuntimeException(
                    "CHẶN XÓA: Sản phẩm '" + sp.getTenSP() + "' đang còn tồn kho (" + tongTon + "). " +
                            "Vui lòng xuất kho hoặc điều chỉnh về 0 trước khi xóa."
            );
        }
        // 3. Xóa sản phẩm (Soft Delete: DaXoa = 1)
        sanPhamRepository.deleteById(id);

        // 4. Ghi log
        logActivity(tenNguoiXoa, "Xóa sản phẩm ID: " + id);
    }

    // =================================================================
    // 4. READ
    // =================================================================
    public List<SanPham> getAllSanPham() {
        return sanPhamRepository.findAll();
    }

    public SanPham getSanPhamById(Integer id) {
        return sanPhamRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy sản phẩm"));
    }

    // Hàm ghi log
    private void logActivity(String tenDangNhap, String hanhDong) {
        var user = nguoiDungRepository.findByTenDangNhap(tenDangNhap).orElse(null);
        if (user != null) {
            HoatDong log = new HoatDong();
            log.setMaNguoiDung(user.getMaNguoiDung());
            log.setHanhDong(hanhDong);
            log.setThoiGianThucHien(java.time.LocalDateTime.now()); // Lấy giờ Java (đã set UTC+7)
            hoatDongRepository.save(log);
        }
    }
    public List<SanPham> filterSanPham(SanPhamFilterRequest request) {
        return sanPhamRepository.filter(request);
    }

    // [CẬP NHẬT] Logic check trùng tên có hỗ trợ update
    private void validateProductUniqueness(SanPhamRequest request, Integer currentId) {
        // BƯỚC 1: Lấy tên sản phẩm từ request và cắt khoảng trắng thừa
        String tenSpCheck = request.getTenSP().trim();

        // BƯỚC 2: Tìm tất cả sản phẩm đang hoạt động (Chưa xóa) có cùng tên
        List<SanPham> existingProducts = sanPhamRepository.findByTenSPIncludingDeleted(tenSpCheck);

        // BƯỚC 3: Kiểm tra trùng lặp
        for (SanPham sp : existingProducts) {
            // Nếu đang UPDATE (currentId != null) và sản phẩm tìm thấy chính là sản phẩm đang sửa -> Bỏ qua
            if (currentId != null && sp.getMaSP().equals(currentId)) {
                continue; 
            }

            // Nếu tìm thấy một sản phẩm KHÁC có cùng tên -> Báo lỗi ngay
            throw new RuntimeException(
                "Lỗi trùng lặp: Tên sản phẩm '" + tenSpCheck + "' đã tồn tại trong hệ thống. Vui lòng chọn tên khác!"
            );
        }
    }

    public List<SanPham> getTrash() {
        return sanPhamRepository.findAllDeleted();
    }

    public void restoreSanPham(int id) {
        // 1. Tìm sản phẩm trong thùng rác để lấy MaLoai
        SanPham sp = sanPhamRepository.findByIdIncludingDeleted(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy sản phẩm ID: " + id));

        // 2. Kiểm tra xem Loại hàng của nó có bị xóa không?
        if (loaiHangRepository.isDeleted(sp.getMaLoai())) {
            // NẾU CÓ: Chặn lại và báo lỗi
            throw new RuntimeException("Không thể khôi phục! Loại hàng của sản phẩm này đang bị xóa. Vui lòng khôi phục Loại hàng trước.");
        }

        // 3. Nếu Loại hàng vẫn Active, thì cho phép khôi phục sản phẩm
        sanPhamRepository.restoreById(id);
    }
}