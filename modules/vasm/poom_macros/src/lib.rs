extern crate proc_macro;

use proc_macro::TokenStream;

mod enums;
mod arity;
mod with_arg;
mod field_values;
mod variant_index;

use arity::insert_arity_method;
use with_arg::insert_arg_method;
use field_values::insert_field_values_method;
use variant_index::insert_variant_index_method;

#[proc_macro_derive(Arity)]
pub fn derive_arity(input: TokenStream) -> TokenStream {
    insert_arity_method(input)
}

#[proc_macro_derive(InsertArgs)]
pub fn derive_with_args(input: TokenStream) -> TokenStream {
    insert_arg_method(input)
}

#[proc_macro_derive(FieldValues)]
pub fn derive_field_values(input: TokenStream) -> TokenStream {
    insert_field_values_method(input)
}

#[proc_macro_derive(VariantIndex)]
pub fn derive_variant_index(input: TokenStream) -> TokenStream {
    insert_variant_index_method(input)
}
