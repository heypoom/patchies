/// Extend the target vector with the input vector, but if the target vector
/// would exceed the maximum capacity, remove the oldest values from the
/// target vector until it is within the maximum capacity.
pub fn extend_and_remove_oldest(target: &mut Vec<u16>, input: Vec<u16>, max_cap: usize) {
    let src_len = input.len();
    let dst_len = target.len();
    let new_size = dst_len + src_len;

    target.extend(&input);

    if new_size > max_cap {
        target.drain(0..(new_size - max_cap));
    }
}

#[cfg(test)]
mod test_vec_helper {
    use super::extend_and_remove_oldest;

    #[test]
    fn test_extend_and_remove_oldest() {
        let mut target = vec![1, 2, 3, 4, 5];
        let input = vec![6, 7, 8, 9, 10];
        extend_and_remove_oldest(&mut target, input, 10);
        assert_eq!(target, vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

        let mut target = vec![1, 2, 3, 4, 5];
        let input = vec![6, 7, 8, 9, 10];
        extend_and_remove_oldest(&mut target, input, 5);
        assert_eq!(target, vec![6, 7, 8, 9, 10]);

        let mut target = vec![1, 2, 3, 4, 5];
        let input = vec![6, 7, 8, 9, 10];
        extend_and_remove_oldest(&mut target, input, 3);
        assert_eq!(target, vec![8, 9, 10]);
    }
}