#[cfg(test)]
mod enum_tests {
    use poom_macros::{InsertArgs, Arity, FieldValues, VariantIndex};

    #[derive(Debug, PartialEq, InsertArgs, Arity, FieldValues, VariantIndex)]
    enum Foo {
        Pop,
        Push(u16),
        Foo(u16, u16, u16),
    }

    #[test]
    fn test_with_arg() {
        assert_eq!(Foo::Pop.with_arg(|| 12), Foo::Pop);
        assert_eq!(Foo::Push(0).with_arg(|| 24), Foo::Push(24));
        assert_eq!(Foo::Foo(0, 0, 0).with_arg(|| 6), Foo::Foo(6, 6, 6));
    }

    #[test]
    fn test_arity() {
        assert_eq!(Foo::Pop.arity(), 0);
        assert_eq!(Foo::Push(1).arity(), 1);
        assert_eq!(Foo::Foo(0, 0, 0).arity(), 3);
    }

    #[test]
    fn test_field_values() {
        assert_eq!(Foo::Pop.field_values(), []);
        assert_eq!(Foo::Push(1).field_values(), [1]);
        assert_eq!(Foo::Foo(12, 12, 12).field_values(), [12, 12, 12]);
    }

    #[test]
    fn test_variant_index() {
        assert_eq!(Foo::Pop.index(), 0);
        assert_eq!(Foo::Push(1).index(), 1);
        assert_eq!(Foo::Foo(12, 12, 12).index(), 2);
    }
}
