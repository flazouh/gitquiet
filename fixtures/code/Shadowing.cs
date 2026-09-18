// Every case the C# vocabulary has to get right, in one file.
//
// Read by src/ledger/dialects/csharp.test.ts and by a person. What earns it is
// how much of C# is a declaration wrapping a declaration.
using System;
using System.Collections.Generic;
using Widget = App.Other.Thing;

namespace App.Shapes
{
    public class Box : Base
    {
        private int size;
        public const int Limit = 10;
        public int Size { get; set; }

        public Box(int size) { this.size = size; }

        public int Draw(int n)
        {
            var total = n * size;
            foreach (var row in Rows()) { total += row; }
            for (int i = 0; i < 3; i++) { total += i; }
            try { total += Risky(); }
            catch (Exception err) { return 0; }
            Func<int, int> doubled = z => z * 2;
            return total + doubled(1);
        }

        private int Risky() => Limit;
        private List<int> Rows() => null;

        public T Pick<T>(T one, T two) where T : IComparable<T> => one;
    }

    public interface IShape { int Area(); }

    public enum Kind { Round, Square }

    public record Point(int X, int Y);

    public struct Small { public int N; }
}
