extern crate proc_macro;

use proc_macro::TokenStream;
use quote::{format_ident, quote};
use syn::{parse_macro_input, Data, DeriveInput};

use crate::enums::variant_arity;

pub fn insert_field_values_method(input: TokenStream) -> TokenStream {
    let ast = parse_macro_input!(input as DeriveInput);

    // Ensure that the input is an enum
    if let Data::Enum(data_enum) = &ast.data {
        let enum_name = &ast.ident;

        let field_value_match = data_enum.variants.iter().map(|variant| {
            let field_count = variant_arity(variant);

            // Extract the variant's identifier.
            let variant_ident = &variant.ident;

            // Empty fields return an empty vector.
            if field_count == 0 {
                return quote! {
                    #enum_name::#variant_ident => vec![]
                };
            }

            let field_vars = (0..field_count).map(|i| {
                let id = format_ident!("f{}", i);
                quote! { #id }
            });

            let field_values = field_vars.clone();

            quote! {
                #enum_name::#variant_ident(#(#field_vars,)*) => vec![
                    #(*#field_values,)*
                ]
            }
        });

        // Insert the method into the enum.
        let expanded = quote! {
            impl #enum_name {
                pub fn field_values(&self) -> Vec<u16> {
                    match self {
                        #(#field_value_match,)*
                    }
                }
            }
        };

        expanded.into()
    } else {
        panic!("Field values can only be derived for enums");
    }
}