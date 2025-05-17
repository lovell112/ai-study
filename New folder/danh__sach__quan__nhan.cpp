#include <iostream>
#include <vector>
#include <cstdlib>
#include <ctime>
#include <sstream>
#include <fstream>
#include <algorithm>
using namespace std;

// === CLASS GỐC ===
class QuanNhan {
protected:
    string maSo, hoTen, capBac, donVi, ngaySinh, ngayNhapNgu;
public:
    QuanNhan(string ms, string ht, string cb, string dv, string ns, string nnn)
        : maSo(ms), hoTen(ht), capBac(cb), donVi(dv), ngaySinh(ns), ngayNhapNgu(nnn) {}
    virtual string toCSV() = 0; // Pure virtual
    virtual ~QuanNhan() {}
};

// === CLASS BINH SĨ ===
class BinhSi : public QuanNhan {
    string nhiemVu;
public:
    BinhSi(string ms, string ht, string cb, string dv, string ns, string nnn, string nv)
        : QuanNhan(ms, ht, cb, dv, ns, nnn), nhiemVu(nv) {}
    string toCSV() override {
        stringstream ss;
        ss << maSo << "," << hoTen << "," << capBac << "," << donVi << "," 
           << ngaySinh << "," << ngayNhapNgu << "," << nhiemVu << ",BinhSi";
        return ss.str();
    }
};

// === CLASS SĨ QUAN ===
class SiQuan : public QuanNhan {
    string chucVu;
public:
    SiQuan(string ms, string ht, string cb, string dv, string ns, string nnn, string cv)
        : QuanNhan(ms, ht, cb, dv, ns, nnn), chucVu(cv) {}
    string toCSV() override {
        stringstream ss;
        ss << maSo << "," << hoTen << "," << capBac << "," << donVi << "," 
           << ngaySinh << "," << ngayNhapNgu << "," << chucVu << ",SiQuan";
        return ss.str();
    }
};

// === DỮ LIỆU MẪU ===
vector<string> ho = {"Nguyen", "Tran", "Le", "Pham", "Vo", "Dang", "Bui", "Hoang", "Ngo", "Do"};
vector<string> tenDem = {"Minh", "Thi", "Quang", "Thanh", "Duy", "Son", "Anh", "Phu", "Kien", "Tam"};
vector<string> ten = {"Tu", "Lan", "Son", "Hieu", "Mai", "Quang", "Duc", "Hieu", "Anh", "Mai"};
vector<string> capBacBinhSi = {"Binh nhat", "Binh nhi"};
vector<string> capBacSiQuan = {"Thieu uy", "Trung uy", "Dai uy", "Thieu ta"};
vector<string> donViMau = {"Tieu doan 1", "Tieu doan 2", "Trung doan 3"};
vector<string> nhiemVuMau = {"Canh gac", "Truyen tin", "Van chuyen", "Hau can"};
vector<string> chucVuMau = {"Dai doi truong", "Tieu doan pho", "Chinh tri vien", "Tham muu phu"};

// === HÀM NGẪU NHIÊN ===
string randomTu(vector<string>& ds) {
    return ds[rand() % ds.size()];
}

string randomNgay(int startYear = 1980, int endYear = 2000) {
    int d = rand() % 28 + 1;
    int m = rand() % 12 + 1;
    int y = rand() % (endYear - startYear + 1) + startYear;
    stringstream ss;
    ss << (d < 10 ? "0" : "") << d << "/" << (m < 10 ? "0" : "") << m << "/" << y;
    return ss.str();
}

string taoMaSo(int index, char prefix) {
    stringstream ss;
    ss << prefix << "-";
    if (index < 10) ss << "00" << index;
    else if (index < 100) ss << "0" << index;
    else ss << index;
    return ss.str();
}

// === MAIN ===
int main() {
    srand(time(0));
    vector<QuanNhan*> danhSach;

    // Tạo 300 Binh sĩ
    for (int i = 1; i <= 300; i++) {
        danhSach.push_back(new BinhSi(
            taoMaSo(i, 'B'),
            randomTu(ho) + " " + randomTu(tenDem) + " " + randomTu(ten),
            randomTu(capBacBinhSi),
            randomTu(donViMau),
            randomNgay(1985, 2003),
            randomNgay(2010, 2023),
            randomTu(nhiemVuMau)
        ));
    }

    // Tạo 100 Sĩ quan
    for (int i = 1; i <= 100; i++) {
        danhSach.push_back(new SiQuan(
            taoMaSo(i, 'S'),
            randomTu(ho) + " " + randomTu(tenDem) + " " + randomTu(ten),
            randomTu(capBacSiQuan),
            randomTu(donViMau),
            randomNgay(1975, 1990),
            randomNgay(2000, 2015),
            randomTu(chucVuMau)
        ));
    }

    // Ghi vào file CSV
    ofstream outFile("danhsach_quannhan.txt");
    if (!outFile) {
        cerr << "Không thể tạo file CSV!" << endl;
        return 1;
    }

    // Tiêu đề cột
    outFile << "maSo,hoTen,capBac,donVi,ngaySinh,ngayNhapNgu,chucVu/nhiemVu,loai\n";

    for (QuanNhan* qn : danhSach) {
        outFile << qn->toCSV() << "\n";
    }

    cout << "finish write on file.txt" << endl;

    // Giải phóng bộ nhớ
    for (QuanNhan* qn : danhSach) delete qn;
    return 0;
}
