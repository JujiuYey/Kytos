//! Project-wide error type for the gacha module. Renders to a Chinese string
//! suitable for surfacing directly in the UI toast.

use std::fmt;

#[derive(Debug, Clone)]
pub struct ApiMartError(pub String);

impl fmt::Display for ApiMartError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for ApiMartError {}

impl From<std::io::Error> for ApiMartError {
    fn from(e: std::io::Error) -> Self {
        Self(format!("io 错误: {e}"))
    }
}

impl From<reqwest::Error> for ApiMartError {
    fn from(e: reqwest::Error) -> Self {
        Self(format!("APIMart request failed: {e}"))
    }
}

impl From<serde_json::Error> for ApiMartError {
    fn from(e: serde_json::Error) -> Self {
        Self(format!("JSON 解析失败: {e}"))
    }
}

impl From<base64::DecodeError> for ApiMartError {
    fn from(e: base64::DecodeError) -> Self {
        Self(format!("base64 解码失败: {e}"))
    }
}