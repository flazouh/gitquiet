// Every case the C++ vocabulary has to get right, in one file.
//
// Read by src/ledger/dialects/cpp.test.ts and by a person. What earns it is the
// declarator: a name sits at the bottom of a stack of wrappers saying what it is.
#include <vector>
#include "local/helper.h"

namespace app {

const int LIMIT = 10;

int area(int shape, int scale) {
    int total = shape * scale;
    for (int i = 0; i < 3; i++) { total += i; }
    for (auto row : rows()) { total += row; }
    try { total += risky(); }
    catch (const std::exception& err) { return 0; }
    auto doubled = [](int z) { return z * 2; };
    return total + doubled(1);
}

int risky() { return LIMIT; }

class Box : public Base {
public:
    explicit Box(int size) : size_(size) {}
    int draw(int n) { return area(n, size_); }
private:
    int size_;
};

struct Point { int x; int y; };

enum class Kind { Round, Square };

template <typename T> T pick(T one, T two) { return one; }

using Widget = Point;

}
