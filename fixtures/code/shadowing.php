<?php
// Every case the PHP vocabulary has to get right, in one file.
//
// Read by src/ledger/dialects/php.test.ts and by a person. Two things here are
// PHP's own: a variable is a name inside a name, and binding happens at the
// function rather than at the block.
namespace App\Shapes;

use App\Base;
use App\Other\Thing as Widget;
use App\Grouped\{Alpha, Beta};

const LIMIT = 10;

function area(int $shape, int $scale = 1): int {
    $total = $shape * $scale;
    foreach ([1, 2] as $row) { $total += $row; }
    for ($i = 0; $i < 3; $i++) { $total += $i; }
    try { $total += risky(); }
    catch (Exception $err) { return 0; }
    $doubled = fn($z) => $z * 2;
    return $total + $doubled(1);
}

function risky(): int { return LIMIT; }

class Box extends Base {
    private int $size = 4;
    const SIDES = 4;

    public function __construct(int $size) { $this->size = $size; }

    public function draw(int $n): int { return area($n, $this->size); }
}

interface Shape { public function area(): int; }

trait Drawable { public function drawn(): bool { return true; } }
