extern crate proc_macro;

use proc_macro::TokenStream;
use quote::{quote};
use syn::{parse_macro_input, Data, DeriveInput};

use crate::enums::variant_arity;

pub fn insert_arity_method(input: TokenStream) -> TokenStream {
    let ast = parse_macro_input!(input as DeriveInput);

    // Ensure that the input is an enum
    if let Data::Enum(data_enum) = &ast.data {
        let enum_name = &ast.ident;
        let arity_values = data_enum.variants.iter().map(|variant| {
            let field_count = variant_arity(variant);

            // Extract the variant's identifier.
            let variant_ident = &variant.ident;

            // If the arity is zero, match against the variant identifier, e.g. `Foo::Bar => 0`
            if field_count == 0 {
                return quote! {
                    #enum_name::#variant_ident => 0
                };
            }

            // Otherwise, match against the fields as well, e.g. `Foo::Baz(..) => 2`
            quote! {
                #enum_name::#variant_ident(..) => #field_count
            }
        });

        // Insert the arity method into the enum.
        let expanded = quote! {
            impl #enum_name {
                pub fn arity(&self) -> usize {
                    match self {
                        #(#arity_values,)*
                    }
                }
            }
        };

        expanded.into()
    } else {
        panic!("Arity can only be derived for enums");
    }
}