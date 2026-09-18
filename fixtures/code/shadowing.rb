# Every case the Ruby vocabulary has to get right, in one file.
#
# Read by src/ledger/dialects/ruby.test.ts and by a person. Two things here are
# Ruby's own: a method is called with no receiver, and a `for` leaves its name
# behind where a block does not.
require 'set'
require_relative 'local/helper'

LIMIT = 10

if LIMIT > 1
  leaked = 1
end

module Shapes
  class Box < Base
    attr_reader :size
    SIDES = 4

    def initialize(size)
      @size = size
    end

    def draw(n)
      total = n * @size
      [1, 2].each { |row| total += row }
      for i in 0..3
        total += i
      end
      begin
        total += risky
      rescue StandardError => err
        return 0
      end
      total
    end

    def self.build(n) = new(n)

    private

    def risky
      LIMIT
    end
  end

  Kind = Struct.new(:name)
end

doubled = ->(z) { z * 2 }
first, second = 1, 2
