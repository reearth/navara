use std::collections::HashMap;

use bevy_ecs::event::{Event, EventReader, EventWriter};
use bevy_ecs::resource::Resource;
use bevy_ecs::system::{Res, ResMut};

use navara_math::{EqualEpsilon, FloatType, Vec2};
use navara_window::Window;

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
    pub position: Vec2,
    pub prev_position: Option<Vec2>,
}

#[derive(Default, Debug, Clone, PartialEq, Resource)]
pub struct TouchList {
    pub touches: HashMap<i32, TouchPoint>,
}

#[derive(Debug, Clone, PartialEq, Event)]
pub struct TouchInput {
    pub state: TouchState,
    pub position: Vec2,
    pub id: i32,
}

pub fn process_touch_input_events(
    mut ev: EventReader<TouchInput>,
    mut touch_list: ResMut<TouchList>,
    mut gesture_ev: EventWriter<TouchControl>,
    window: Res<Window>,
) {
    for touch in ev.read() {
        match touch.state {
            TouchState::Start | TouchState::Move => {
                let prev_position = touch_list
                    .touches
                    .get(&(touch.id))
                    .map_or(touch.position, |t| t.position);

                let duplicate_touch_point = (prev_position.x as i32 == touch.position.x as i32)
                    && (prev_position.y as i32 == touch.position.y as i32);

                if duplicate_touch_point && touch.state == TouchState::Move {
                    continue;
                }

                touch_list.touches.insert(
                    touch.id,
                    TouchPoint {
                        position: touch.position,
                        prev_position: Some(prev_position),
                    },
                );
            }
            TouchState::End => {
                touch_list.touches.remove(&(touch.id));
            }
        }

        if let Some(gesture) = recognize_gesture(&touch_list, &window) {
            gesture_ev.write(gesture);
        }
    }
}

#[derive(Debug, Clone, PartialEq, Event)]
pub struct TouchControl {
    pub gesture: TouchGesture,
    pub delta: Vec2,
}

fn recognize_gesture(touch_list: &TouchList, window: &Window) -> Option<TouchControl> {
    if touch_list.touches.len() == 2 {
        let mut touches = touch_list.touches.values();
        let p1 = touches.next().unwrap();
        let p2 = touches.next().unwrap();

        let (p1_prev, p2_prev) = match (p1.prev_position, p2.prev_position) {
            (Some(pp1), Some(pp2)) => (pp1, pp2),
            _ => return None,
        };
        let (p1_pos, p2_pos) = (p1.position, p2.position);

        let p1_dir = (p1_pos - p1_prev).normalize();
        let p2_dir = (p2_pos - p2_prev).normalize();

        let dot = p1_dir.dot(p2_dir);

        // both directions are almost parallel - cos(theata) ~= 1.0
        if dot.equal_diff_epsilon(1.0, 0.1) {
            // same direction - two finger swipe
            return Some(TouchControl {
                gesture: TouchGesture::DoubleSwipe,
                delta: ((p1_pos - p1_prev)
                    / Vec2::new(window.width as FloatType, window.height as FloatType))
                    * 5.0,
            });
        }

        let prev_distance = (p1_prev - p2_prev).length();
        let current_distance = (p1_pos - p2_pos).length();

        if current_distance > prev_distance {
            return Some(TouchControl {
                gesture: TouchGesture::Spread,
                delta: Vec2::new((prev_distance - current_distance) * 10.0, 0.0),
            });
        } else if current_distance < prev_distance {
            return Some(TouchControl {
                gesture: TouchGesture::Pinch,
                delta: Vec2::new((prev_distance - current_distance) * 10.0, 0.0),
            });
        }
    } else if touch_list.touches.len() == 1 {
        let touch = touch_list.touches.values().next().unwrap();
        let delta = if let Some(prev_pos) = touch.prev_position {
            (touch.position - prev_pos)
                / Vec2::new(window.width as FloatType, window.height as FloatType)
        } else {
            Vec2::new(0.0, 0.0)
        };
        return Some(TouchControl {
            gesture: TouchGesture::Swipe,
            delta,
        });
    }

    None
}
