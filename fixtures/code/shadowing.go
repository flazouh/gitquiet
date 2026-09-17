// Every case the Go vocabulary has to get right, in one file.
//
// Read by src/ledger/dialects/go.test.ts and by a person. What is here rather
// than in shadowing.ts is what Go spells its own way: four declarations that
// each wrap their names in a _spec node, a method written outside its type, and
// a receiver that is a parameter list with one parameter in it.
package main

import (
	"fmt"
	m "math"
)

const Limit = 10

const (
	First  = 1
	Second = 2
)

var total int

type Box struct {
	Size int
}

type Shape interface {
	Area() int
}

// A local shadows a parameter, and a block holds its own.
func Area(shape int, scale int) int {
	sum := shape * scale
	for i := 0; i < 3; i++ {
		sum += i
	}
	if v, err := doer(); err == nil {
		return v
	}
	for k, row := range []int{1} {
		sum += k + row
	}
	return sum
}

// The receiver is a name like any other, and is written before the method's.
func (b *Box) Draw(n int) int {
	return Area(n, b.Size)
}

func doer() (int, error) { return 0, nil }

func main() {
	f := func(z int) int { return z + 1 }
	fmt.Println(f(1), m.Pi, total, Limit, First, Second)
}
