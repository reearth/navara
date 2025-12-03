use std::collections::HashMap;

use bevy_ecs::event::{Event, EventReader, EventWriter};
use bevy_ecs::resource::Resource;
use bevy_ecs::system::ResMut;

use bevy_log::info;
use navara_math::Vec2;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TouchState {
    Start,
    End,
    Move,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TouchGesture {
    Swipe,       // single finger swipe
    DoubleSwipe, // two finger swipe up/down - for tilting
    Spread,      // zoom in
    Pinch,       // zoom out
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TouchPoint {
    pub state: TouchState,
    pub id: i32,
    pub position: Vec2, // Relative position from client area. 0.0 - 1.0
    pub prev_position: Option<Vec2>, // Relative position from client area. 0.0 - 1.0
}

#[derive(Default, Debug, Clone, PartialEq, Resource)]
pub struct TouchList {
    pub touches: HashMap<i32, TouchPoint>,
}

#[derive(Debug, Clone, PartialEq, Event)]
pub struct TouchInput {
    pub state: TouchState,
    pub position: Vec2, // Relative position from client area. 0.0 - 1.0
    pub id: i32,
}

pub fn process_touch_input_events(
    mut ev: EventReader<TouchInput>,
    mut touch_list: ResMut<TouchList>,
    mut gesture_ev: EventWriter<TouchControl>,
) {
    for touch in ev.read() {
        match touch.state {
            TouchState::Start | TouchState::Move => {
                let prev_position = touch_list
                    .touches
                    .get(&(touch.id))
                    .map_or(touch.position, |t| t.position);

                touch_list.touches.insert(
                    touch.id,
                    TouchPoint {
                        state: touch.state,
                        id: touch.id,
                        position: touch.position,
                        prev_position: Some(prev_position),
                    },
                );
            }
            TouchState::End => {
                touch_list.touches.remove(&(touch.id));
            }
        }

        if let Some(gesture) = recognize_gesture(&touch_list) {
            info!("Current gesture: {:?}", gesture);
            gesture_ev.write(gesture);
        }
    }
    // info!("Current touches: {:?}", touch_list.touches);
    // info!("-----------------------------------");
}

#[derive(Debug, Clone, PartialEq, Event)]
pub struct TouchControl {
    pub gesture: TouchGesture,
    pub delta: Vec2,
}

fn recognize_gesture(touch_list: &TouchList) -> Option<TouchControl> {
    if touch_list.touches.len() == 2 {
        let p1 = touch_list.touches.values().nth(0).unwrap();
        let p2 = touch_list.touches.values().nth(1).unwrap();

        let (p1_prev, p2_prev) = match (p1.prev_position, p2.prev_position) {
            (Some(pp1), Some(pp2)) => (pp1, pp2),
            _ => return None,
        };
        let (p1_pos, p2_pos) = (p1.position, p2.position);

        let prev_distance = (p1_prev - p2_prev).length();
        let current_distance = (p1_pos - p2_pos).length();

        if current_distance > prev_distance {
            return Some(TouchControl {
                gesture: TouchGesture::Spread,
                delta: Vec2::new((current_distance - prev_distance) * 1000.0, 0.0),
            });
        } else if current_distance < prev_distance {
            return Some(TouchControl {
                gesture: TouchGesture::Pinch,
                delta: Vec2::new((current_distance - prev_distance) * 1000.0, 0.0),
            });
        } else {
            return Some(TouchControl {
                gesture: TouchGesture::DoubleSwipe,
                delta: p1_pos - p1_prev,
            });
        }
    } else if touch_list.touches.len() == 1 {
        let touch = touch_list.touches.values().next().unwrap();
        let delta = if let Some(prev_pos) = touch.prev_position {
            touch.position - prev_pos
        } else {
            Vec2::new(0.0, 0.0)
        };
        return Some(TouchControl {
            gesture: TouchGesture::Swipe,
            delta,
        });
    }

    return None;
}
