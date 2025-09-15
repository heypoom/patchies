use syn::{Variant, Fields};

/// Extract the arity of the variant fields.
pub fn variant_arity(variant: &Variant) -> usize {
    match &variant.fields {
        Fields::Unnamed(fields) => fields.unnamed.len(),

        // The variant fields does not exist. Arity is zero.
        _ => 0,
    }
}