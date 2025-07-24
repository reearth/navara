use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, FnArg, ItemTrait, Path, TraitItem};

/// A procedural macro that generates wasm_bindgen implementations from trait definitions.
///
/// Apply this macro to a trait and specify the struct name that should implement the methods.
/// The macro will generate a wasm_bindgen implementation block for that struct.
///
/// Usage:
/// ```rust
/// use navara_wasm_macro::wasm_idl;
/// use wasm_bindgen::prelude::*;
///
/// #[wasm_idl(IdlExample)]
/// trait Example {
///     fn hello();                              // Static method
///     fn greet(&self, name: &str) -> String;   // Instance method
/// }
///
/// #[wasm_bindgen]
/// struct IdlExample {
///     test: f32,
/// }
/// ```
///
/// This generates:
/// ```rust
/// # use wasm_bindgen::prelude::*;
/// # struct IdlExample { test: f32 }
/// #[wasm_bindgen]
/// impl IdlExample {
///     #[wasm_bindgen]
///     pub fn hello() {
///         unreachable!();
///     }
///     
///     #[wasm_bindgen]
///     pub fn greet(&self, name: &str) -> String {
///         unreachable!();
///     }
/// }
/// ```
#[proc_macro_attribute]
pub fn wasm_idl(args: TokenStream, input: TokenStream) -> TokenStream {
    let struct_name = parse_macro_input!(args as Path);
    let input_trait = parse_macro_input!(input as ItemTrait);

    let struct_ident = struct_name.get_ident().expect("Expected struct name");
    let trait_methods = extract_trait_methods(&input_trait);

    let method_impls = trait_methods.iter().map(|method| {
        let method_name = &method.sig.ident;
        let inputs = &method.sig.inputs;
        let output = &method.sig.output;

        // Check if this is an instance method (has &self)
        let has_self = inputs.iter().any(|arg| matches!(arg, FnArg::Receiver(_)));

        // For wasm_bindgen, we need to include &self in the signature
        let method_params = if has_self {
            // Include &self and other parameters
            let non_self_params = inputs.iter().filter_map(|arg| match arg {
                FnArg::Receiver(_) => None,
                FnArg::Typed(pat_type) => Some(pat_type),
            });

            let param_names = non_self_params.clone().map(|arg| &arg.pat);
            let param_types = non_self_params.map(|arg| &arg.ty);

            quote! {
                &self, #(#param_names: #param_types),*
            }
        } else {
            // Static method - no &self
            let static_params = inputs.iter().filter_map(|arg| match arg {
                FnArg::Receiver(_) => None,
                FnArg::Typed(pat_type) => Some(pat_type),
            });

            let param_names = static_params.clone().map(|arg| &arg.pat);
            let param_types = static_params.map(|arg| &arg.ty);

            quote! {
                #(#param_names: #param_types),*
            }
        };

        quote! {
            #[wasm_bindgen]
            pub fn #method_name(#method_params) #output {
                unreachable!();
            }
        }
    });

    let expanded = quote! {
        #input_trait

        #[wasm_bindgen]
        impl #struct_ident {
            #(#method_impls)*
        }
    };

    TokenStream::from(expanded)
}

fn extract_trait_methods(trait_def: &ItemTrait) -> Vec<&syn::TraitItemFn> {
    trait_def
        .items
        .iter()
        .filter_map(|item| match item {
            TraitItem::Fn(method) => Some(method),
            _ => None,
        })
        .collect()
}
