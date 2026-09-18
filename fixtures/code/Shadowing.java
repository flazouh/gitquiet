// Every case the Java vocabulary has to get right, in one file.
//
// Read by src/ledger/dialects/java.test.ts and by a person. What is here rather
// than in shadowing.ts is the one thing Java does that none of the others do:
// it calls its own methods without a receiver, so a method's name is a name.
package com.example.app;

import java.util.List;
import java.util.Map.Entry;
import static java.lang.Math.max;

public class Box {
    private int size;
    static final int LIMIT = 10;

    public Box(int size) { this.size = size; }

    public int draw(int n) {
        int total = n * size;
        for (int i = 0; i < 3; i++) { total += i; }
        for (String row : rows()) { total += row.length(); }
        try { total += risky(); }
        catch (Exception err) { return 0; }
        return total;
    }

    <T extends Comparable<T>> T pick(T one, T two) { return one; }

    interface Shape { int area(); }

    enum Kind { ROUND, SQUARE }

    // A bare call, which is the whole reason Java binds a method's name.
    private int risky() { return LIMIT; }

    private List<String> rows() { return null; }
}
