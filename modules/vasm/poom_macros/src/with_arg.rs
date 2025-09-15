extern crate proc_macro;

use proc_macro::TokenStream;
use quote::{quote};
use syn::{parse_macro_input, Data, DeriveInput};

use crate::enums::variant_arity;

pub fn insert_arg_method(input: TokenStream) -> TokenStream {
    let ast = parse_macro_input!(input as DeriveInput);

    // Ensure that the input is an enum
    if let Data::Enum(data_enum) = &ast.data {
        let enum_name = &ast.ident;

        // Transform the match arms
        let match_arms = data_enum.variants.iter().map(|variant| {
            let field_count = variant_arity(variant);
            let variant_ident = &variant.ident;

            if field_count == 0 {
                return quote! {
                    #enum_name::#variant_ident => #enum_name::#variant_ident
                };
            }

            // Retrieve the arguments by using the arg_fn mutable closure.
            // We use Rc<RefCell>> to allow the closure to be called multiple times.
            let args = (0..field_count).map(|_| quote! {
                {
                    let arg_fn = arg_fn.clone();
                    let mut arg_fn = arg_fn.borrow_mut();
                    arg_fn()
                }
            });

            // Otherwise, match against the fields as well, e.g. `Foo::Baz(..) => 2`
            quote! {
                #enum_name::#variant_ident(..) => #enum_name::#variant_ident(
                    #(#args,)*
                )
            }
        });

        // Insert the method into the enum.
        let expanded = quote! {
            use std::rc::Rc as __with_arg_Rc;
            use std::cell::RefCell as __with_arg_RefCell;

            impl #enum_name {
                pub fn with_arg<F>(self, arg_fn: F) -> #enum_name where F: FnMut() -> u16 {
                    let arg_fn = __with_arg_Rc::new(__with_arg_RefCell::new(arg_fn));

                    match self {
                        #(#match_arms,)*
                        v => v
                    }
                }
            }
        };

        expanded.into()
    } else {
        panic!("InsertArg can only be derived for enums");
    }
}
