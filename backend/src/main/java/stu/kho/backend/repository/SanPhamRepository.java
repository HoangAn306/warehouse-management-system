package stu.kho.backend.repository;

import java.util.List;
import java.util.Optional;

import stu.kho.backend.dto.SanPhamFilterRequest;
import stu.kho.backend.entity.SanPham;

public interface SanPhamRepository {
    Optional<SanPham> findById(Integer id);
    List<SanPham> findAll();
    int save(SanPham sanPham);
    int update(SanPham sanPham);
    int deleteById(Integer id);
    List<SanPham> filter(SanPhamFilterRequest criteria);
    List<SanPham> findByTenSP(String tenSP);
    void restoreById(Integer id);
    List<SanPham> findAllDeleted();
    Optional<SanPham> findByIdIncludingDeleted(Integer id);
    List<SanPham> findByTenSPIncludingDeleted(String tenSP);
    int countTotalInventory(Integer maSP);// <-- THÊM MỚI
}