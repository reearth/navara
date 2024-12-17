pub fn consume_vec<T>(v: &mut Vec<T>) -> Vec<T> {
    let mut next = Vec::with_capacity(v.len());
    next.append(v);
    next
}
