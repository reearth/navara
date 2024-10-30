#![doc = include_str!("../README.md")]

use bevy_ecs::entity::Entity;
use navara_buffer_store::BufferStore;
use navara_event::Events;
use navara_layer::{LayerDescStore, LayerDescription, LayerId};
use navara_math::FloatType;
use navara_texture_fragment::{TextureFragmentLoadedEvent, TextureFragmentStatus};
use navara_window::{Window, WindowResizeEvent};

mod app;

pub struct App {
    app: bevy_app::App,
    win: bevy_ecs::entity::Entity,
}

impl App {
    pub fn new() -> Self {
        let mut app = bevy_app::App::new();

        app.add_plugins(app::Plugin);

        let win = app.world_mut().spawn_empty().id();

        Self { app, win }
    }

    pub fn update(&mut self) {
        self.app.update();
    }

    pub fn trigger_event(&mut self, ev: navara_input::Input) {
        navara_input::trigger_event(self.app.world_mut(), self.win, ev);
    }

    pub fn read_events(&mut self) -> Option<Events> {
        let ev = self
            .app
            .world()
            .get_resource::<navara_event_store::EventStore>()?;
        Some(Events::from_event_store(self.app.world(), ev))
    }

    pub fn get_buffer_u8(&self, handle: i32) -> Option<&[u8]> {
        let store = self.app.world().get_resource::<BufferStore>()?;
        store.get_u8(&handle)
    }

    pub fn get_buffer_u32(&self, handle: i32) -> Option<&[u32]> {
        let store = self.app.world().get_resource::<BufferStore>()?;
        store.get_u32(&handle)
    }

    pub fn get_buffer_f32(&self, handle: i32) -> Option<&[FloatType]> {
        let store = self.app.world().get_resource::<BufferStore>()?;
        store.get_f32(&handle)
    }

    pub fn set_buffer(&mut self, handle: i32, bits: u64, data: Vec<u8>) {
        let Some(mut store) = self.app.world_mut().get_resource_mut::<BufferStore>() else {
            return;
        };
        store.set_u8(handle, data);
        self.app
            .world_mut()
            .send_event(navara_buffer_store::BufferStoreLoadedEvent {
                id: Entity::from_bits(bits),
                ty: navara_buffer_store::BufferType::U8,
            });
    }

    pub fn trigger_data_requester_failed(&mut self, bits: u64) {
        self.app
            .world_mut()
            .send_event(navara_buffer_store::BufferStoreFailedEvent {
                id: Entity::from_bits(bits),
            });
    }

    pub fn resize(&mut self, width: FloatType, height: FloatType, pixel_ratio: FloatType) {
        let Some(mut window_res) = self.app.world_mut().get_resource_mut::<Window>() else {
            return;
        };

        window_res.height = height * pixel_ratio;
        window_res.width = width * pixel_ratio;
        window_res.pixel_ratio = pixel_ratio;

        self.app.world_mut().send_event(WindowResizeEvent {
            width,
            height,
            pixel_ratio,
        });
    }

    pub fn trigger_texture_fragment_loaded(&mut self, bits: u64, status: TextureFragmentStatus) {
        self.app.world_mut().send_event(TextureFragmentLoadedEvent {
            id: Entity::from_bits(bits),
            status,
        });
    }

    pub fn add_layer(&mut self, layer_id: &str, desc: LayerDescription) {
        if let Some(mut layer_desc_store) =
            self.app.world_mut().get_resource_mut::<LayerDescStore>()
        {
            layer_desc_store
                .map
                .insert(layer_id.to_owned(), desc.clone());
        }

        self.app
            .world_mut()
            .send_event(navara_layer_event::AddLayerEvent(desc));
    }

    pub fn get_layer_type(&mut self, layer_id: &String) -> &str {
        let mut layer_type = "";
        if let Some(layer_desc_store) = self.app.world().get_resource::<LayerDescStore>() {
            if let Some(desc) = layer_desc_store.map.get(layer_id) {
                layer_type = match desc {
                    LayerDescription::Tiles(_) => "tiles",
                    LayerDescription::Terrain(_) => "terrain",
                    LayerDescription::GeoJson(_) => "geojson",
                    LayerDescription::B3dm(_) => "b3dm",
                    LayerDescription::Mvt(_) => "mvt",
                    LayerDescription::Cesium3dTiles(_) => "cesium3dtiles",
                };
            }
        }

        layer_type
    }

    pub fn update_layer(&mut self, layer_id: &str, desc: LayerDescription) {
        // TODO: Support multiple appearance
        let appearance = match desc {
            LayerDescription::GeoJson(layer) => layer.appearances[0].clone(),
            LayerDescription::B3dm(layer) => layer.appearances[0].clone(),
            LayerDescription::Cesium3dTiles(layer) => layer.appearances[0].clone(),
            _ => return,
        };
        self.app
            .world_mut()
            .send_event(navara_layer_event::UpdateLayerEvent {
                layer_id: LayerId(layer_id.to_owned()),
                appearance,
            });
    }

    pub fn delete_layer(&mut self, layer_id: &str) {
        self.app
            .world_mut()
            .send_event(navara_layer_event::DeleteLayerEvent(LayerId(
                layer_id.to_owned(),
            )));
    }
}

impl Default for App {
    fn default() -> Self {
        Self::new()
    }
}
