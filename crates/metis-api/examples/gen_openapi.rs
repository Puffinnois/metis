//! Generates the OpenAPI spec and writes it to `docs/openapi.json`.
//!
//! Run from the repository root:
//! ```
//! cargo run -p metis-api --example gen_openapi
//! ```

use std::path::PathBuf;

use metis_api::ApiDoc;
use utoipa::OpenApi;

fn main() {
    let spec = ApiDoc::openapi()
        .to_pretty_json()
        .expect("serialize OpenAPI spec");
    let out = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("docs/openapi.json");
    std::fs::write(&out, &spec).expect("write docs/openapi.json");
    println!("OpenAPI spec written to {}", out.display());
}
