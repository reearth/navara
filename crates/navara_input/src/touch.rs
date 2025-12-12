use std::collections::HashMap;

use bevy_ecs::event::{Event, EventReader, EventWriter};
use bevy_ecs::resource::Resource;
use bevy_ecs::system::{Res, ResMut};

use bevy_input::{gestures, touch};
use bevy_log::info;
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
    Rotate,      // rotate gesture (not implemented yet)
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

                let duplicate_touch_point =
                    (prev_position.x == touch.position.x) && (prev_position.y == touch.position.y);

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

        if let Some(gesture) = recognize_gesture(&mut touch_list, &window) {
            info!("Recognized gesture: {:?}", gesture);
            gesture_ev.write(gesture);
        }
    }
}

#[derive(Debug, Clone, PartialEq, Event)]
pub struct TouchControl {
    pub gesture: TouchGesture,
    pub delta: Vec2,
}

fn recognize_gesture(touch_list: &mut TouchList, window: &Window) -> Option<TouchControl> {
    if touch_list.touches.len() == 2 {
        let mut touches = touch_list.touches.values();
        let p1 = touches.next().unwrap();
        let p2 = touches.next().unwrap();

        // disambiguate between double swipe, rotate and spread/pinch
        let double_swipe_delta = recognize_double_swipe_gesture(p1, p2);
        let rotate_delta = recognize_rotate_gesture(p1, p2);
        let spread_pinch_delta = recognize_spread_pinch_gesture(p1, p2);

        info!(
            "Recognized gesture deltas - rotate: {:?}, spread/pinch: {:?}, double swipe: {:?}",
            rotate_delta,
            spread_pinch_delta,
            double_swipe_delta
        );
        let dominant_gesture =
            disambiguate_gesture(rotate_delta, spread_pinch_delta, double_swipe_delta, p1, p2);

        info!("Dominant gesture: {:?}", dominant_gesture);
        match dominant_gesture {
            Some(TouchGesture::Rotate) => {
                let gesture = TouchControl {
                    gesture: TouchGesture::Rotate,
                    delta: Vec2::new(rotate_delta.unwrap_or(0.0) / 360.0, 0.0),
                };
                return Some(gesture);
            }
            Some(TouchGesture::Pinch) => {
                let gesture = TouchControl {
                    gesture: TouchGesture::Pinch,
                    delta: Vec2::splat(spread_pinch_delta.unwrap_or(0.0)),
                };
                return Some(gesture);
            }
            Some(TouchGesture::Spread) => {
                let gesture = TouchControl {
                    gesture: TouchGesture::Spread,
                    delta: Vec2::splat(spread_pinch_delta.unwrap_or(0.0)),
                };
                return Some(gesture);
            }
            Some(TouchGesture::DoubleSwipe) => {
                let gesture = TouchControl {
                    gesture: TouchGesture::DoubleSwipe,
                    delta: Vec2::new(
                        0.0,
                        double_swipe_delta.unwrap_or(0.0) / window.height as FloatType,
                    ),
                };
                return Some(gesture);
            }
            _ => {}
        }
    } else if touch_list.touches.len() == 1 {
        let p = touch_list.touches.values().next().unwrap();

        if let Some(delta) = recognize_swipe_gesture(p) {
            let gesture = TouchControl {
                gesture: TouchGesture::Swipe,
                delta: Vec2::new(
                    delta.x / window.width as FloatType,
                    delta.y / window.height as FloatType,
                ),
            };
            return Some(gesture);
        }
    }

    None
}

fn disambiguate_gesture(
    rotate_delta: Option<FloatType>,
    spread_pinch_delta: Option<FloatType>,
    double_swipe_delta: Option<FloatType>,
    p1: &TouchPoint,
    p2: &TouchPoint,
) -> Option<TouchGesture> {
    let mut gesture_deltas = [FloatType::NEG_INFINITY; 3]; // rotate, spread/pinch, double swipe

    if rotate_delta.is_some() {
        let rotate_delta_degrees = rotate_delta.unwrap();

        let circle_radius = (p1.position - p2.position).length();
        let rotate_arc_length_pixels = (rotate_delta_degrees.to_radians()) * circle_radius;
        gesture_deltas[0] = rotate_arc_length_pixels.abs();
    }
    if spread_pinch_delta.is_some() {
        gesture_deltas[1] = spread_pinch_delta.unwrap().abs();
    }
    if double_swipe_delta.is_some() {
        gesture_deltas[2] = double_swipe_delta.unwrap().abs();
    }

    let max_delta_index = gesture_deltas
        .iter()
        .enumerate()
        .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
        .map(|(i, _)| i)?;

    info!("gesture deltas: {:?}", gesture_deltas);

    match max_delta_index {
        0 => Some(TouchGesture::Rotate),
        1 => {
            if spread_pinch_delta.unwrap() > 0.0 {
                Some(TouchGesture::Pinch)
            } else {
                Some(TouchGesture::Spread)
            }
        }
        2 => Some(TouchGesture::DoubleSwipe),
        _ => None,
    }
}

fn recognize_double_swipe_gesture(p1: &TouchPoint, p2: &TouchPoint) -> Option<FloatType> {
    let (p1_prev, p2_prev) = match (p1.prev_position, p2.prev_position) {
        (Some(pp1), Some(pp2)) => (pp1, pp2),
        _ => return None,
    };
    let (p1_pos, p2_pos) = (p1.position, p2.position);

    let p1_dir = (p1_pos - p1_prev).normalize();
    let p2_dir = (p2_pos - p2_prev).normalize();

    let dot = p1_dir.dot(p2_dir);

    // both directions are almost parallel - cos(theata) ~= 1.0
    // same direction - two finger swipe
    if dot.equal_diff_epsilon(1.0, 0.1) {
        return Some(p1_pos.y - p1_prev.y);
    }

    None
}

fn recognize_spread_pinch_gesture(p1: &TouchPoint, p2: &TouchPoint) -> Option<FloatType> {
    let (p1_prev, p2_prev) = match (p1.prev_position, p2.prev_position) {
        (Some(pp1), Some(pp2)) => (pp1, pp2),
        _ => return None,
    };
    let (p1_pos, p2_pos) = (p1.position, p2.position);

    let prev_distance = (p1_prev - p2_prev).length();
    let current_distance = (p1_pos - p2_pos).length();

    if current_distance != prev_distance {
        return Some(prev_distance - current_distance);
    }
    None
}

fn recognize_rotate_gesture(p1: &TouchPoint, p2: &TouchPoint) -> Option<FloatType> {
    let (p1_prev, p2_prev) = match (p1.prev_position, p2.prev_position) {
        (Some(pp1), Some(pp2)) => (pp1, pp2),
        _ => return None,
    };
    let (p1_pos, p2_pos) = (p1.position, p2.position);

    let delta_x = p1_pos.x - p2_pos.x;
    let delta_y = p1_pos.y - p2_pos.y;
    let angle_current = delta_y.atan2(delta_x);

    let delta_x_prev = p1_prev.x - p2_prev.x;
    let delta_y_prev = p1_prev.y - p2_prev.y;
    let angle_prev = delta_y_prev.atan2(delta_x_prev);

    let mut delta = (angle_current - angle_prev).to_degrees();

    if delta > 180.0 {
        delta -= 360.0;
    } else if delta < -180.0 {
        delta += 360.0;
    }

    Some(delta)
}

fn recognize_swipe_gesture(p: &TouchPoint) -> Option<Vec2> {
    if let Some(prev_pos) = p.prev_position {
        return Some(p.position - prev_pos);
    }
    None
}
