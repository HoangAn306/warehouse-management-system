package stu.kho.backend.repository;

import stu.kho.backend.entity.ChiTietDieuChuyen;

import java.util.List;

public interface ChiTietDieuChuyenRepository {
    int save(ChiTietDieuChuyen ct);

    List<ChiTietDieuChuyen> findByMaPhieuDC(Integer maPhieuDC);

    void deleteByMaPhieuDC(Integer maPhieuDC);
}
