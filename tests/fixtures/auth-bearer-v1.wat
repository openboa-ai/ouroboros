;; Independently delivered v1 package. Input token at 0; one Bearer value at 32768.
(module
  (memory (export "memory") 1 1)
  (data (i32.const 32768) "Bearer ")
  (func (export "authenticate") (param $size i32) (result i32)
    (memory.copy (i32.const 32775) (i32.const 0) (local.get $size))
    (i32.add (local.get $size) (i32.const 7))))
