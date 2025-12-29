package stu.kho.backend.repository;

import stu.kho.backend.dto.SanPhamTrongKhoResponse;
import stu.kho.backend.entity.ChiTietKho;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface ChiTietKhoRepository {

    // Tìm một sản phẩm cụ thể trong một kho cụ thể
    Optional<ChiTietKho> findById(Integer maSP, Integer maKho);

    // Cập nhật số lượng tồn kho (dùng cho Nhập/Xuất)
    int updateSoLuongTon(Integer maSP, Integer maKho, int soLuongMoi);

    // Thêm sản phẩm mới vào kho (nếu chưa có)
    int save(ChiTietKho chiTietKho);
    //Tim san pham theo ma kho
    List<SanPhamTrongKhoResponse> findSanPhamByMaKho(Integer maKho);
    Optional<ChiTietKho> findByIdForUpdate(Integer maSP, Integer maKho);
    List<Map<String, Object>> findBatchesForAutoPick(Integer maKho, Integer maSP);

    void upsertTonKho(Integer maKho, Integer maSP, String batchName, LocalDate ngayHetHan, Integer soLuongThayDoi);
    boolean checkLooTonTai(Integer maKho, Integer maSP, String soLo);

    }