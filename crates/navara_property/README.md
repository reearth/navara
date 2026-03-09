# Navara Property

This is a library to abstract feature's property as an intermediate expression. Since the property is JSON, we have to convert it as a struct.  
However the property becomes really large, so we want to avoid the conversion twice.  
For example, we might convert the JSON property as a struct by `serde`, then convert the struct into JSValue for WASM. It must takes a lot of time.  
To avoid such situation, this crate is used. You can convert the property into JSValue directly without `serde` conversion if you use this crate.
